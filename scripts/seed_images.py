import os
import sys
import urllib.request
import sqlite3
from PIL import Image, ImageDraw, ImageFont

IMG_DIR = '/home/admin/Projects-main/frontend/public/images/products'
os.makedirs(IMG_DIR, exist_ok=True)

# Curated high-res Unsplash food photos (direct, fast CDN URLs)
CATEGORY_IMAGE_URLS = {
    'cat-burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    'cat-sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
    'cat-momo': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80',
    'cat-fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80',
    'cat-maggi': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=80',
    'cat-pasta': 'https://images.unsplash.com/photo-1621996346565-e3d5d62817d2?w=600&auto=format&fit=crop&q=80',
    'cat-vadapav': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&auto=format&fit=crop&q=80',
    'cat-bunmuska': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    'cat-corn': 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop&q=80',
    'cat-wraps': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80',
    'cat-chai': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    'cat-hot-coffee': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    'cat-cold-coffee': 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    'cat-mojito': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
    'cat-shakes': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
    'cat-lemonades': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    'cat-lassi': 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=600&auto=format&fit=crop&q=80',
    'cat-icetea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    'cat-icecrush': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&auto=format&fit=crop&q=80',
}

# Individual specific product photo overrides for variety
ITEM_SPECIFIC_URLS = {
    'prod-b-3': 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80', # Paneerzilla
    'prod-b-4': 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80', # HG Special Burger
    'prod-s-4': 'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=600&auto=format&fit=crop&q=80', # Tandoori Paneer Sandwich
    'prod-s-7': 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&auto=format&fit=crop&q=80', # The Hourglass Special Sandwich
    'prod-m-4': 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600&auto=format&fit=crop&q=80', # Fried momo
    'prod-m-7': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80', # Kurkure momo
    'prod-m-16': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80', # Momo Platter
    'prod-fn-2': 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=600&auto=format&fit=crop&q=80', # Peri peri fries
    'prod-fn-4': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80', # Nuggets
    'prod-fn-5': 'https://images.unsplash.com/photo-1619860860774-1e2e17343432?w=600&auto=format&fit=crop&q=80', # Garlic bread
    'prod-p-1': 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop&q=80', # Alfredo
    'prod-p-2': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80', # Arrabiata
    'prod-c-1': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&auto=format&fit=crop&q=80', # Espresso
    'prod-c-3': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&auto=format&fit=crop&q=80', # Cappuccino
    'prod-c-11': 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&auto=format&fit=crop&q=80', # Hot Chocolate
    'prod-cc-6': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80', # Cold coffee with ice cream
    'prod-cc-7': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=600&auto=format&fit=crop&q=80', # Hazelnut Frappe
    'prod-sh-1': 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=600&auto=format&fit=crop&q=80', # Chocolate shake
    'prod-sh-3': 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=600&auto=format&fit=crop&q=80', # Oreo shake
    'prod-sh-7': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&auto=format&fit=crop&q=80', # Brownie shake
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

def download_and_crop(url, out_path):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = resp.read()
    
    tmp_path = out_path + '.tmp'
    with open(tmp_path, 'wb') as f:
        f.write(data)
    
    with Image.open(tmp_path) as im:
        im = im.convert('RGB')
        # Center square crop
        w, h = im.size
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top = (h - min_dim) // 2
        im_cropped = im.crop((left, top, left + min_dim, top + min_dim))
        im_resized = im_cropped.resize((400, 400), Image.Resampling.LANCZOS)
        im_resized.save(out_path, 'WEBP', quality=85)
    
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

db = sqlite3.connect('/home/admin/Projects-main/flo.db')
cursor = db.cursor()
products = cursor.execute('SELECT id, category_id, name FROM products').fetchall()
print(f"Total products to process: {len(products)}")

# First cache category base images
cat_cached = {}
for cat_id, url in CATEGORY_IMAGE_URLS.items():
    cache_path = os.path.join(IMG_DIR, f"{cat_id}_base.webp")
    if not os.path.exists(cache_path):
        try:
            print(f"Downloading base image for {cat_id}...")
            download_and_crop(url, cache_path)
            cat_cached[cat_id] = cache_path
        except Exception as e:
            print(f"Error downloading {cat_id}: {e}")
    else:
        cat_cached[cat_id] = cache_path

# Now process each product
success_count = 0
for prod_id, cat_id, name in products:
    target_path = os.path.join(IMG_DIR, f"{prod_id}.webp")
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
        success_count += 1
        continue
    
    try:
        if prod_id in ITEM_SPECIFIC_URLS:
            download_and_crop(ITEM_SPECIFIC_URLS[prod_id], target_path)
        elif cat_id in cat_cached and os.path.exists(cat_cached[cat_id]):
            # Copy or link category image
            with Image.open(cat_cached[cat_id]) as im:
                im.save(target_path, 'WEBP', quality=85)
        else:
            # Fallback to category URL
            url = CATEGORY_IMAGE_URLS.get(cat_id)
            if url:
                download_and_crop(url, target_path)
        
        if os.path.exists(target_path):
            success_count += 1
    except Exception as e:
        print(f"Error on product {prod_id} ({name}): {e}")

# Update DB to point image_url to /images/products/{prod_id}.webp
cursor.execute("UPDATE products SET image_url = '/images/products/' || id || '.webp'")
db.commit()
print(f"Updated {db.total_changes} rows in database.")
print(f"Completed! {success_count}/{len(products)} products have valid webp images.")
