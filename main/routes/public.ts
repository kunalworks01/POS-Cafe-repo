import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDatabase, now } from '../db';
import { stripPhoneDigits, parsePhoneE164 } from '../lib/phone';
import { notifyKdsUpdate, notifyOrderUpdated } from '../services/kds';
import { renderOrderInvoiceSms, CAFE_BASE_URL } from '../services/sms-templates';
import { sendAmazonSnsSms } from '../services/amazon-sns';

export const publicRoutes = Router();

// List of Famous / Hot Sellers product IDs from Hourglass Cafe menu
const FEATURED_PRODUCT_IDS = new Set([
  'prod-b-4',  // The H. G. Special Burger
  'prod-b-3',  // Paneerzilla Burger
  'prod-s-7',  // The Hourglass Special Sandwich
  'prod-s-4',  // Tandoori Paneer Sandwich
  'prod-m-1',  // Veg Steamed Momo
  'prod-m-8',  // Paneer Kurkure Momo
  'prod-m-16', // H. G. Special Momo Platter
  'prod-f-2',  // Peri-Peri O' Clock Fries
  'prod-f-3',  // Say Cheese! Fries
  'prod-mg-2', // Cheese Loaded Maggi
  'prod-p-1',  // Creamy Alfredo White Sauce Pasta
  'prod-vp-1', // Classic Mumbai Vada Pav
  'prod-bm-1', // Irani Bun Muska
  'prod-ch-4', // Kulhad Chai
  'prod-c-3',  // Cappuccino
  'prod-cc-7', // Hazelnut Frappe
  'prod-mj-1', // Classic Mint Mojito
  'prod-sh-7', // Brownie Blast Thick Shake
  'prod-ls-1', // Classic Sweet Lassi
]);

export interface OperationalStatus {
  isOpen: boolean;
  statusLabel: string;
  openTimeStr: string;
  closeTimeStr: string;
  estimatedWaitTime: string;
  isPreorder: boolean;
  nextOpeningTime: string;
  hoursNotice: string;
  queueNotice: string;
}

export function getCafeOperationalStatus(): OperationalStatus {
  // Use Indian Standard Time (IST, UTC+5:30)
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 3600000;
  const istDate = new Date(utcMs + istOffset);

  const currentHour = istDate.getHours();
  const currentMinute = istDate.getMinutes();
  const currentTimeDec = currentHour + (currentMinute / 60);

  const OPEN_HOUR = 10;
  const CLOSE_HOUR = 23;

  const isOpen = currentTimeDec >= OPEN_HOUR && currentTimeDec < CLOSE_HOUR;

  if (isOpen) {
    return {
      isOpen: true,
      statusLabel: 'Open Now',
      openTimeStr: '10:00 AM',
      closeTimeStr: '11:00 PM',
      estimatedWaitTime: '15-20 minutes',
      isPreorder: false,
      nextOpeningTime: 'Open until 11:00 PM',
      hoursNotice: '🟢 Kitchen is actively preparing live orders.',
      queueNotice: 'Standard live prep queue (15-20 mins).',
    };
  }

  const isEarlyMorning = currentHour < OPEN_HOUR;
  const nextOpeningTime = isEarlyMorning ? 'Today at 10:00 AM' : 'Tomorrow at 10:00 AM';

  return {
    isOpen: false,
    statusLabel: 'Closed (Pre-Orders Open)',
    openTimeStr: '10:00 AM',
    closeTimeStr: '11:00 PM',
    estimatedWaitTime: `Freshly prepared at ${nextOpeningTime}`,
    isPreorder: true,
    nextOpeningTime,
    hoursNotice: `🌙 Kitchen opens at ${nextOpeningTime}. Pre-orders are queued first-come, first-served!`,
    queueNotice: `Pre-order FIFO Queue: Earliest order gets #1 priority at 10:00 AM opening.`,
  };
}

export function calculatePreOrderQueuePriority(db: any): { queuePriority: number; closedStartIso: string } {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 3600000;
  const istDate = new Date(utcMs + istOffset);
  const istHour = istDate.getHours();

  // Find start of closed window in IST
  const closedStartDate = new Date(istDate);
  if (istHour < 10) {
    closedStartDate.setDate(closedStartDate.getDate() - 1);
  }
  closedStartDate.setHours(23, 0, 0, 0);

  // Convert to UTC ISO for database comparison
  const closedStartUtc = new Date(closedStartDate.getTime() - istOffset);
  const closedStartIso = closedStartUtc.toISOString();

  const countRow = db.prepare(`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE created_at >= ? AND (special_instructions LIKE '%PRE-ORDER%' OR status = 'pending')
  `).get(closedStartIso) as { count: number };

  const queuePriority = (countRow?.count || 0) + 1;
  return { queuePriority, closedStartIso };
}

/**
 * 1. Public Cafe Profile Info
 */
publicRoutes.get('/cafe-info', (_req: Request, res: Response) => {
  const operational = getCafeOperationalStatus();
  res.json({
    name: 'Hourglass Cafe',
    tagline: 'Taste The Rhythm of Time',
    phone: '+91 96431 77506',
    instagram: '@the_hourglasscafe',
    currency: 'INR',
    currencySymbol: '₹',
    address: 'C-42, Shastri Nagar, Ghaziabad, UP',
    hours: '10:00 AM - 11:00 PM (Everyday)',
    orderMode: 'Pickup & Takeaway',
    estimatedPrepTime: operational.estimatedWaitTime,
    operationalStatus: operational,
    loyaltyOffer: 'Earn reward points on every product bought, redeemable for discounts on future orders!',
  });
});

/**
 * 2. Public Menu (Categories, Products, Featured Items, Addons)
 */
publicRoutes.get('/menu', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const categories = db.prepare(`
      SELECT id, name, sort_order 
      FROM categories 
      ORDER BY sort_order ASC, name ASC
    `).all() as any[];

    const products = db.prepare(`
      SELECT p.id, p.category_id, p.name, p.description, p.price, p.tags, p.sort_order,
             CASE WHEN (p.image_url IS NOT NULL AND p.image_url != '') THEN 1 ELSE 1 END AS has_image,
             p.image_url
      FROM products p
      WHERE p.deleted_at IS NULL AND p.is_active = 1
      ORDER BY p.sort_order ASC, p.name ASC
    `).all() as any[];

    const addonGroups = db.prepare(`
      SELECT ag.id, ag.name, ag.min_selection, ag.max_selection
      FROM addon_groups ag
      WHERE ag.is_active = 1
    `).all() as any[];

    for (const group of addonGroups) {
      group.addons = db.prepare(`
        SELECT id, name, price 
        FROM addons 
        WHERE addon_group_id = ? AND is_active = 1
        ORDER BY sort_order ASC, name ASC
      `).all(group.id);
    }

    const formattedProducts = products.map((prod) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = typeof prod.tags === 'string' ? JSON.parse(prod.tags) : (prod.tags || []);
      } catch (_) {
        parsedTags = [];
      }

      return {
        ...prod,
        tags: parsedTags,
        is_featured: FEATURED_PRODUCT_IDS.has(prod.id),
      };
    });

    const hotSellers = formattedProducts.filter((p) => p.is_featured);

    res.json({
      cafe: {
        name: 'Hourglass Cafe',
        tagline: 'Taste The Rhythm of Time',
        phone: '+91 96431 77506',
        instagram: '@the_hourglasscafe',
        currency: 'INR',
        currencySymbol: '₹',
      },
      categories,
      products: formattedProducts,
      hotSellers,
      addonGroups,
    });
  } catch (error: any) {
    console.error('[Public menu error]', error);
    res.status(500).json({ error: 'Failed to load cafe menu' });
  }
});

/**
 * 2b. Public Categories List
 */
publicRoutes.get('/categories', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const categories = db.prepare(`
      SELECT id, name, sort_order 
      FROM categories 
      ORDER BY sort_order ASC, name ASC
    `).all();
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

/**
 * 3. Public Order Placement (Pickup at Cafe)
 */
publicRoutes.post('/orders', (req: Request, res: Response) => {
  try {
    const {
      customer_name,
      customer_phone,
      pickup_notes,
      items,
      loyalty_subscribed,
      payment_choice = 'online', // 'online' | 'pay_at_cafe'
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const name = String(customer_name || 'Guest Customer').trim();
    const phone = String(customer_phone || '').trim();

    const db = getDatabase();
    const tenantCountry = 'IN';
    const parsedPhone = parsePhoneE164(phone, tenantCountry);
    const finalPhone = parsedPhone ? parsedPhone.e164 : phone || null;
    const phoneDigits = finalPhone ? stripPhoneDigits(finalPhone) : null;

    // Resolve or create customer
    let customerId: string | null = null;
    if (finalPhone && phoneDigits) {
      const existing = db.prepare('SELECT id, name FROM customers WHERE is_active = 1 AND phone_digits = ?').get(phoneDigits) as any;
      if (existing) {
        customerId = existing.id;
      } else {
        customerId = `cust-${randomUUID()}`;
        const nowTs = now();
        db.prepare(`
          INSERT INTO customers (id, phone, name, country_code, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'Online Pickup Customer', ?, ?)
        `).run(customerId, finalPhone, name, parsedPhone?.countryCode || '+91', nowTs, nowTs);

        if (loyalty_subscribed) {
          // Bonus welcome points
          db.prepare(`
            INSERT INTO loyalty_ledger (customer_id, type, amount, description, created_at, updated_at)
            VALUES (?, 'credit', 20, 'Welcome bonus for subscribing to loyalty program', ?, ?)
          `).run(customerId, nowTs, nowTs);
        }
      }
    }

    // Check Cafe Operational Status (IST Hours: 10:00 AM - 11:00 PM)
    const operational = getCafeOperationalStatus();
    let queuePriority: number | null = null;
    let isPreorder = operational.isPreorder;

    if (isPreorder) {
      const queueData = calculatePreOrderQueuePriority(db);
      queuePriority = queueData.queuePriority;
    }

    // Generate Order Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countRow = db.prepare("SELECT COUNT(*) as count FROM orders WHERE created_at >= date('now')").get() as { count: number };
    const orderSequence = (countRow.count || 0) + 1;
    const orderNumber = `HG-${dateStr.slice(4)}-${String(orderSequence).padStart(3, '0')}`;

    // Calculate subtotal and validate items
    let subtotal = 0;
    const orderItemRows: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      price: number;
      total: number;
      addons: any[] | null;
      special_instructions: string | null;
    }> = [];

    for (const item of items) {
      const prod = db.prepare('SELECT id, name, price FROM products WHERE id = ? AND deleted_at IS NULL').get(item.product_id) as any;
      if (!prod) continue;

      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      let itemPrice = Number(prod.price);
      let addonsList: any[] = [];

      if (Array.isArray(item.addons)) {
        for (const a of item.addons) {
          const addonRow = db.prepare('SELECT id, name, price FROM addons WHERE id = ?').get(a.id) as any;
          if (addonRow) {
            addonsList.push({ id: addonRow.id, name: addonRow.name, price: Number(addonRow.price), quantity: a.quantity || 1 });
            itemPrice += Number(addonRow.price) * (a.quantity || 1);
          }
        }
      }

      const itemTotal = itemPrice * qty;
      subtotal += itemTotal;

      orderItemRows.push({
        product_id: prod.id,
        product_name: prod.name,
        quantity: qty,
        price: Number(prod.price),
        total: itemTotal,
        addons: addonsList.length > 0 ? addonsList : null,
        special_instructions: item.special_instructions ? String(item.special_instructions).slice(0, 200) : null,
      });
    }

    if (orderItemRows.length === 0) {
      return res.status(400).json({ error: 'No valid products in order' });
    }

    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const total = Math.round(subtotal + taxAmount);
    const nowTs = now();

    // Default system user (owner) for online orders
    const ownerUser = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get() as any;
    const userId = ownerUser?.id || null;

    const orderTag = isPreorder
      ? `🌙 PRE-ORDER (Queue #${queuePriority} for 10:00 AM Opening)`
      : `🟢 LIVE ORDER (Prep: 15-20 Mins)`;

    const paymentTag = payment_choice === 'pay_at_cafe'
      ? `💵 Pay at Cafe Counter (Cash/Card/UPI on Pickup)`
      : `📱 Paid/Pay Online (UPI Instant)`;

    const specialInstructions = [
      orderTag,
      paymentTag,
      '📦 PACKED / TAKEAWAY (Online Pickup)',
      name ? `Customer: ${name}` : '',
      finalPhone ? `Phone: ${finalPhone}` : '',
      pickup_notes ? `Notes: ${pickup_notes}` : '',
    ].filter(Boolean).join(' | ');

    const result = db.prepare(`
      INSERT INTO orders (
        order_number, customer_id, user_id, type, delivery_address,
        special_instructions, subtotal, tax_amount, total, status,
        online_platform, external_order_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'online', 'Store Pickup', ?, ?, ?, ?, 'pending', 'Hourglass Web', ?, ?, ?)
    `).run(
      orderNumber,
      customerId,
      userId,
      specialInstructions,
      subtotal,
      taxAmount,
      total,
      `WEB-${randomUUID().slice(0, 8).toUpperCase()}`,
      nowTs,
      nowTs
    );

    const orderId = Number(result.lastInsertRowid);

    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, unit_price, quantity, subtotal, total,
        special_instructions, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    const insertAddon = db.prepare(`
      INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, price, quantity, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const oi of orderItemRows) {
      const itemRes = insertItem.run(
        orderId,
        oi.product_id,
        oi.product_name,
        oi.price,
        oi.quantity,
        oi.total,
        oi.total,
        oi.special_instructions,
        nowTs,
        nowTs
      );

      if (oi.addons && Array.isArray(oi.addons)) {
        const orderItemId = Number(itemRes.lastInsertRowid);
        for (const a of oi.addons) {
          insertAddon.run(orderItemId, a.id, a.name, a.price, a.quantity || 1, nowTs);
        }
      }
    }

    // Award loyalty points for products bought (1 point per product)
    if (customerId) {
      const totalPointsEarned = orderItemRows.reduce((sum, item) => sum + item.quantity, 0);
      try {
        db.prepare(`
          INSERT INTO loyalty_ledger (customer_id, type, amount, description, created_at, updated_at)
          VALUES (?, 'credit', ?, ?, ?, ?)
        `).run(customerId, totalPointsEarned, `Points earned on order ${orderNumber}`, nowTs, nowTs);
      } catch (_) {}
    }

    // Broadcast to Kitchen Display System (KDS) & POS immediately!
    notifyKdsUpdate();
    notifyOrderUpdated();

    // Formulate Order SMS
    const waitTime = isPreorder ? operational.estimatedWaitTime : '15-20 minutes';
    const invoiceUrl = `${CAFE_BASE_URL}/api/public/invoice/${orderNumber}`;
    const trackingUrl = `${CAFE_BASE_URL}/order?status=${orderNumber}`;

    const orderSms = isPreorder
      ? `Hi, Your pre-order at Hourglass cafe is confirmed! Queue Priority: #${queuePriority} for 10:00 AM opening (First-Come, First-Served). Settle bill: ${payment_choice === 'pay_at_cafe' ? 'At counter with cash/UPI/Card' : `(${trackingUrl}#pay)`}. Post payment your invoice will be generated.`
      : `Hi, Your order at Hourglass cafe will be ready in 15-20 minutes, You can settle the bill here (${trackingUrl}#pay) or at the counter with cash/UPI/Credit card/Debit Card, Post payment your invoice will be generated`;

    if (finalPhone) {
      void sendAmazonSnsSms(finalPhone, orderSms).catch((err) => {
        console.warn('[Public order SMS error]', err);
      });
    }

    return res.status(201).json({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        customer_name: name,
        customer_phone: finalPhone,
        items: orderItemRows,
        subtotal,
        tax_amount: taxAmount,
        total,
        status: 'pending',
        is_preorder: isPreorder,
        queue_priority: queuePriority,
        scheduled_for: isPreorder ? operational.nextOpeningTime : 'Immediate Kitchen Prep',
        payment_choice,
        estimated_ready_time: waitTime,
        invoice_url: invoiceUrl,
        tracking_url: trackingUrl,
        sms_notification: orderSms,
        operational_status: operational,
      },
    });
  } catch (error: any) {
    console.error('[Public order error]', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

/**
 * 4. Public Order Status Tracker
 */
publicRoutes.get('/orders/:order_number', (req: Request, res: Response) => {
  try {
    const { order_number } = req.params;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_number) as any;
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
    const parsedItems = items.map((i) => ({
      ...i,
      addons: i.addons ? JSON.parse(i.addons) : [],
    }));

    const customer = order.customer_id ? db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(order.customer_id) : null;
    const operational = getCafeOperationalStatus();

    // Check if instructions note pre-order or payment choice
    const isPreorder = Boolean(order.special_instructions?.includes('PRE-ORDER'));
    const queueMatch = order.special_instructions?.match(/Queue #(\d+)/);
    const queuePriority = queueMatch ? parseInt(queueMatch[1], 10) : null;
    const paymentChoice = order.special_instructions?.includes('Pay at Cafe Counter') ? 'pay_at_cafe' : 'online';

    res.json({
      order: {
        ...order,
        items: parsedItems,
        customer,
        is_preorder: isPreorder,
        queue_priority: queuePriority,
        payment_choice: paymentChoice,
        operational_status: operational,
        cafe: {
          name: 'Hourglass Cafe',
          tagline: 'Taste The Rhythm of Time',
          phone: '+91 96431 77506',
          instagram: '@the_hourglasscafe',
          upi_id: 'hourglasscafe@upi',
        },
      },
    });
  } catch (error: any) {
    console.error('[Public order status error]', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

/**
 * 5. Public Digital Tax Invoice (HTML & JSON for Download / Save)
 */
publicRoutes.get('/invoice/:order_number', (req: Request, res: Response) => {
  try {
    const { order_number } = req.params;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_number) as any;
    if (!order) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invoice Not Found - Hourglass Cafe</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:sans-serif;text-align:center;padding:50px 20px;background:#faf8f5;color:#333;}.btn{display:inline-block;padding:10px 20px;background:#8c532b;color:#fff;text-decoration:none;border-radius:8px;margin-top:20px;}</style></head>
        <body>
          <h2>Invoice Not Found</h2>
          <p>Order #${order_number} could not be found. Please check the order number or contact Hourglass Cafe.</p>
          <a href="/order" class="btn">Return to Menu</a>
        </body>
        </html>
      `);
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
    const parsedItems = items.map((i) => {
      let addonsList = [];
      try {
        addonsList = i.addons ? JSON.parse(i.addons) : [];
      } catch (_) {}
      return { ...i, addons: addonsList };
    });

    const customer = order.customer_id ? db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id) as any : null;
    let loyaltyBalance = 0;
    if (customer) {
      const balanceRow = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance 
        FROM loyalty_ledger WHERE customer_id = ?
      `).get(customer.id) as any;
      loyaltyBalance = balanceRow?.balance || 0;
    }

    // If JSON format requested
    if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        invoice: {
          order_number: order.order_number,
          date: order.created_at,
          customer_name: customer?.name || 'Valued Customer',
          customer_phone: customer?.phone || '',
          items: parsedItems,
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          total: order.total,
          status: order.status,
          loyalty_points: loyaltyBalance,
          cafe: {
            name: 'Hourglass Cafe',
            tagline: 'Taste The Rhythm of Time',
            address: 'C-42, Shastri Nagar, Ghaziabad, UP',
            phone: '+91 96431 77506',
            instagram: '@the_hourglasscafe',
          },
        },
      });
    }

    // Render Clean, Mobile-Friendly, Printable Digital Invoice HTML
    const formattedDate = new Date(order.created_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const taxFormatted = Number(order.tax_amount || 0).toFixed(2);

    const itemsRowsHtml = parsedItems.map((item, idx) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f0ebe4; font-size: 14px;">
          <strong>${item.product_name}</strong>
          ${item.addons && item.addons.length > 0 ? `<div style="font-size: 11px; color: #786c67; margin-top: 2px;">+ ${item.addons.map((a: any) => a.name).join(', ')}</div>` : ''}
          ${item.special_instructions ? `<div style="font-size: 11px; color: #8c532b; font-style: italic;">Note: ${item.special_instructions}</div>` : ''}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f0ebe4; text-align: center; font-size: 14px;">${item.quantity}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f0ebe4; text-align: right; font-size: 14px;">₹${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f0ebe4; text-align: right; font-weight: 700; font-size: 14px;">₹${Number(item.total).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${order.order_number} - Hourglass Cafe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 16px; color: #2c2523; }
    .invoice-card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e8e2dc; }
    .header { background: linear-gradient(135deg, #2b1e1a 0%, #4a342c 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0 0 4px 0; font-size: 24px; letter-spacing: 2px; color: #f5e6d3; }
    .header p { margin: 0; font-size: 12px; letter-spacing: 1px; color: #d4a373; text-transform: uppercase; font-weight: 600; }
    .body { padding: 24px 20px; }
    .meta-box { display: flex; justify-content: space-between; border-bottom: 2px dashed #e8e2dc; padding-bottom: 16px; margin-bottom: 16px; font-size: 13px; line-height: 1.5; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .items-table th { background: #faf7f2; padding: 8px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #786c67; border-bottom: 1px solid #e8e2dc; }
    .summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .summary-table td { padding: 6px 8px; }
    .grand-total { font-size: 20px; font-weight: 900; color: #8c532b; border-top: 2px solid #2b1e1a; border-bottom: 2px solid #2b1e1a; padding: 10px 8px; }
    .loyalty-banner { background: #faf4ed; border: 1px solid #d4a373; border-radius: 10px; padding: 14px; margin-top: 20px; text-align: center; font-size: 13px; color: #4a3e39; }
    .btn-group { display: flex; gap: 10px; margin-top: 24px; }
    .btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; text-decoration: none; cursor: pointer; border: none; }
    .btn-primary { background: #8c532b; color: #fff; }
    .btn-secondary { background: #f0ebe4; color: #4a3e39; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; max-width: 100%; }
      .btn-group { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <h1>HOURGLASS CAFE</h1>
      <p>Taste The Rhythm of Time</p>
      <div style="font-size: 11px; margin-top: 6px; color: #e8e2dc;">C-42, Shastri Nagar, Ghaziabad, UP · Phone: +91 96431 77506</div>
      <div style="font-size: 11px; font-weight: 600; color: #d4a373; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Customer Invoice</div>
    </div>
    <div class="body">
      <div class="meta-box">
        <div>
          <div><strong>Invoice / Order:</strong> #${order.order_number}</div>
          <div><strong>Date:</strong> ${formattedDate}</div>
          <div><strong>Order Type:</strong> Online Pickup</div>
        </div>
        <div style="text-align: right;">
          <div><strong>Customer:</strong> ${customer?.name || 'Valued Customer'}</div>
          <div><strong>Phone:</strong> ${customer?.phone || 'N/A'}</div>
          <div><strong>Status:</strong> <span style="color: #2e7d32; font-weight: 700; text-transform: uppercase;">${order.status}</span></div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <table class="summary-table">
        <tr>
          <td style="color: #786c67;">Subtotal:</td>
          <td style="text-align: right; font-weight: 600;">₹${Number(order.subtotal).toFixed(2)}</td>
        </tr>
        ${Number(order.tax_amount) > 0 ? `
        <tr>
          <td style="color: #786c67;">Tax:</td>
          <td style="text-align: right; font-weight: 600;">₹${taxFormatted}</td>
        </tr>` : ''}
        <tr class="grand-total">
          <td>Grand Total:</td>
          <td style="text-align: right;">₹${Number(order.total).toFixed(2)}</td>
        </tr>
      </table>

      <div class="loyalty-banner">
        <strong>✨ Hourglass Cafe Loyalty Rewards</strong><br>
        Current Balance: <strong>${loyaltyBalance} Points</strong> (Worth ₹${(loyaltyBalance * 0.5).toFixed(2)} in discounts)<br>
        <span style="font-size: 11px; color: #786c67;">Present your phone number on your next visit to redeem points!</span>
      </div>

      <div class="btn-group">
        <button onclick="window.print()" class="btn btn-primary">🖨️ Download / Print Invoice</button>
        <a href="/order" class="btn btn-secondary">🍔 Order Again</a>
      </div>

      <div style="text-align: center; margin-top: 24px; font-size: 11px; color: #9c928a;">
        Thank you for choosing Hourglass Cafe! Follow us on Instagram: <strong>@the_hourglasscafe</strong>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    console.error('[Public invoice error]', error);
    res.status(500).send('Failed to generate invoice');
  }
});

/**
 * 6. Resend Invoice SMS
 */
publicRoutes.post('/invoice/:order_number/resend-sms', async (req: Request, res: Response) => {
  try {
    const { order_number } = req.params;
    const { phone } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order_number) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const customer = order.customer_id ? db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(order.customer_id) as any : null;
    const targetPhone = phone || customer?.phone;
    if (!targetPhone) return res.status(400).json({ error: 'Customer phone number is required' });

    const items = db.prepare('SELECT product_name, quantity FROM order_items WHERE order_id = ?').all(order.id) as any[];
    const itemsSummary = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');

    const invoiceUrl = `${CAFE_BASE_URL}/api/public/invoice/${order.order_number}`;
    const sms = renderOrderInvoiceSms({
      customerName: customer?.name,
      orderNumber: order.order_number,
      itemsSummary,
      totalAmount: order.total,
      invoiceUrl,
    });

    const result = await sendAmazonSnsSms(targetPhone, sms);
    res.json({ success: true, message: 'Invoice SMS sent successfully', result, smsBody: sms });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to resend SMS' });
  }
});

/**
 * 7. Public AI Upsell Recommendations (Online Ordering)
 */
publicRoutes.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { cartItems, customerName, timeOfDay } = req.body;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.json({
        recommendations: [],
        staffPitchScript: 'Enjoy your food!',
        projectedAovIncrease: 0,
      });
    }

    const { generateCartRecommendations } = await import('../services/gemini-ai');
    const result = await generateCartRecommendations({
      cartItems,
      customerName,
      timeOfDay,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Public recommendations error]', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});


