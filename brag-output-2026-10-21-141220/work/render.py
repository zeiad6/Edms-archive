"""EDMS Archive Ultra-Professional V2 Video Renderer — Vertical 1080x1920 @ 30fps.
High-end visual design with glassmorphism, glowing orbs, interactive scanner beam,
OCR recognition boxes, floating metric chips, and crisp Arabic typography.
"""
import math, os, subprocess, sys
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
W, H, FPS, DUR = 1080, 1920, 30, 21.0
CX = W // 2

# High-end color palette (Midnight Obsidian & Electric Cyan/Gold)
BG_TOP = (5, 9, 20)
BG_BOT = (10, 18, 40)
CARD_BG = (13, 24, 52, 220)
CARD_BORDER = (45, 85, 175, 230)
CARD_BORDER_GLOW = (59, 130, 246, 120)

CYAN_NEON = (6, 182, 212)
BLUE_NEON = (59, 130, 246)
GOLD_NEON = (245, 158, 11)
GOLD_LIGHT = (253, 230, 138)
GREEN_NEON = (16, 185, 129)
GREEN_LIGHT = (167, 243, 208)
WHITE = (255, 255, 255)
MUTED = (148, 163, 184)
MUTED_DARK = (100, 116, 139)

FONT_PATH = os.path.join(HERE, "Cairo.ttf")
ICON_PATH = os.path.join(ROOT, "resources", "icon", "icon-512.png")
SCREENSHOT_PATH = os.path.join(ROOT, "public", "screenshot-dashboard.png")

MUSIC_PATH = "/root/.gemini/config/plugins/brag/skills/brag/assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3"
SFX_DIR = "/root/.gemini/config/plugins/brag/skills/brag/assets/sfx"

POSTER_T = 14.0

icon_raw = Image.open(ICON_PATH).convert("RGBA")
screenshot_raw = Image.open(SCREENSHOT_PATH).convert("RGBA")

@lru_cache(maxsize=None)
def get_font(size):
    return ImageFont.truetype(FONT_PATH, size, layout_engine=ImageFont.Layout.RAQM)

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def prog(t, start, dur):
    return clamp((t - start) / dur)

def ease_out(p):
    return 1.0 - (1.0 - p) ** 3

def ease_in_out(p):
    return 4 * p ** 3 if p < 0.5 else 1.0 - (-2 * p + 2) ** 3 / 2

def ease_back(p, s=1.4):
    p -= 1.0
    return 1.0 + (s + 1.0) * p ** 3 + s * p ** 2

# Pre-render ambient glow stamps
def make_glow(color, size, radius):
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    margin = size // 4
    draw.ellipse((margin, margin, size - margin, size - margin), fill=color)
    return glow.filter(ImageFilter.GaussianBlur(radius))

glow_cyan = make_glow((6, 182, 212, 100), 500, 70)
glow_blue = make_glow((59, 130, 246, 110), 600, 85)
glow_gold = make_glow((245, 158, 11, 100), 500, 75)
glow_purple = make_glow((147, 51, 234, 90), 500, 75)

# Base background gradient + micro grid
base_bg = Image.new("RGBA", (W, H))
for y in range(H):
    factor = y / H
    r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * factor)
    g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * factor)
    b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * factor)
    ImageDraw.Draw(base_bg).line([(0, y), (W, y)], fill=(r, g, b, 255))

draw_grid = ImageDraw.Draw(base_bg)
for gx in range(0, W, 60):
    draw_grid.line([(gx, 0), (gx, H)], fill=(255, 255, 255, 5))
for gy in range(0, H, 60):
    draw_grid.line([(0, gy), (W, gy)], fill=(255, 255, 255, 5))

def draw_glass_card(im, draw, x0, y0, x1, y1, border_color=CARD_BORDER, radius=24, border_w=2, sheen=True):
    # Frosted glass body
    card_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(card_overlay)
    cdraw.rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=CARD_BG, outline=border_color, width=border_w)
    
    # Top reflection sheen
    if sheen:
        sheen_h = min(40, (y1 - y0) // 3)
        cdraw.rounded_rectangle((x0 + 4, y0 + 3, x1 - 4, y0 + sheen_h), radius=radius - 2, fill=(255, 255, 255, 12))
        
    im.alpha_composite(card_overlay)

def draw_badge(draw, text, cx, cy, bg, fg, border=None, font_size=28, pad_x=24, pad_y=10):
    f = get_font(font_size)
    bbox = draw.textbbox((cx, cy), text, font=f, anchor="mm", direction="rtl")
    w = (bbox[2] - bbox[0]) + pad_x * 2
    h = (bbox[3] - bbox[1]) + pad_y * 2
    x0, y0 = cx - w // 2, cy - h // 2
    x1, y1 = cx + w // 2, cy + h // 2
    draw.rounded_rectangle((x0, y0, x1, y1), radius=h // 2, fill=bg, outline=border, width=2 if border else 0)
    draw.text((cx, cy), text, font=f, fill=fg, anchor="mm", direction="rtl")

def draw_header_nav(im, draw, t):
    y = 75
    # Mini icon + glowing badge
    small_ic = icon_raw.resize((48, 48), Image.LANCZOS)
    im.paste(small_ic, (60, y - 24), small_ic)
    draw.text((125, y), "أرشيف  |  EDMS Enterprise", font=get_font(26), fill=WHITE, anchor="lm", direction="rtl")
    draw_badge(draw, "⚡ نظام محلي آمن 100%", 900, y, bg=(20, 45, 90, 200), fg=CYAN_NEON, border=BLUE_NEON, font_size=20, pad_x=16, pad_y=8)
    draw.line([(50, y + 38), (W - 50, y + 38)], fill=(255, 255, 255, 20), width=1)

def render_frame(t):
    im = base_bg.copy()
    
    # Dynamic floating ambient orbs
    orb1_x = int(CX - 200 + 40 * math.sin(t * 1.5))
    orb1_y = int(400 + 50 * math.cos(t * 1.2))
    im.alpha_composite(glow_blue, (orb1_x - 300, orb1_y - 300))
    
    orb2_x = int(CX + 220 + 35 * math.cos(t * 1.8))
    orb2_y = int(1150 + 45 * math.sin(t * 1.4))
    im.alpha_composite(glow_cyan, (orb2_x - 250, orb2_y - 250))
    
    if t > 16.0:
        im.alpha_composite(glow_gold, (CX - 250, 400))
        
    draw = ImageDraw.Draw(im)
    draw_header_nav(im, draw, t)

    # ─────────────────────────────────────────────────────────────
    # SCENE 1: Hook & Dramatic Reveal (0.0s – 3.8s)
    # ─────────────────────────────────────────────────────────────
    if t < 3.8:
        if t < 1.6:
            # Danger / Hook phase
            p_in = ease_out(prog(t, 0.0, 0.45))
            y_off = int((1.0 - p_in) * 70)
            
            draw_badge(draw, "⚠️  مشكلة تؤرق كل إدارة ومؤسسة", CX, 510 - y_off, bg=(60, 20, 25, 240), fg=(254, 202, 202), border=(239, 68, 68), font_size=30)
            
            # Big alert glass card
            draw_glass_card(im, draw, 80, 590 - y_off, W - 80, 1120 - y_off, border_color=(239, 68, 68, 200), radius=32, border_w=3)
            
            draw.text((CX, 700 - y_off), "هل ما زلت تغرق في أكوام الأوراق؟", font=get_font(48), fill=WHITE, anchor="mm", direction="rtl")
            draw.text((CX, 785 - y_off), "ملفات ضائعة وبطء شديد في البحث؟", font=get_font(42), fill=(252, 165, 165), anchor="mm", direction="rtl")
            
            # Stat callout inside hook
            draw.line([(140, 860 - y_off), (W - 140, 860 - y_off)], fill=(255, 255, 255, 20), width=1)
            draw.text((CX, 930 - y_off), "⏳ إهدار أكثر من 30% من ساعات العمل أسبوعياً", font=get_font(32), fill=MUTED, anchor="mm", direction="rtl")
            draw.text((CX, 1000 - y_off), "وصعوبة بالغة في تتبع الاعتمادات والأذونات", font=get_font(30), fill=MUTED, anchor="mm", direction="rtl")

            draw_badge(draw, "الحل الرقمي النهائي وصل 🚀", CX, 1065 - y_off, bg=(25, 20, 30), fg=GOLD_LIGHT, border=GOLD_NEON, font_size=26)
        else:
            # The Reveal: Brand Emblem & Solution
            p_rev = ease_back(prog(t, 1.6, 0.55))
            
            # Big Logo with Glowing Ring
            logo_sz = int(190 * p_rev)
            if logo_sz > 10:
                ic = icon_raw.resize((logo_sz, logo_sz), Image.LANCZOS)
                im.paste(ic, (CX - logo_sz // 2, 470 - logo_sz // 2), ic)
            
            draw.text((CX, 630), "نظام أرشيف الإلكتروني", font=get_font(62), fill=GOLD_LIGHT, anchor="mm", direction="rtl")
            draw.text((CX, 715), "EDMS ARCHIVE ENTERPRISE", font=get_font(30), fill=WHITE, anchor="mm")
            
            draw_badge(draw, "من الماسح الضوئي إلى الأرشيف الموثّق 🚀", CX, 805, bg=(20, 50, 110), fg=WHITE, border=CYAN_NEON, font_size=32)
            
            # 3 High-End Feature Pillars with Micro Badges
            features = [
                ("🖨️ مسح مباشر WIA", "ربط فوري بكافة أجهزة وسكانرات USB والشبكة بضغطة زر"),
                ("🔍 محرك OCR ذكي", "قراءة وفهرسة النصوص داخل الصور والـ PDF بالعربية والإنجليزية"),
                ("🔒 محلي 100% أوفلاين", "يعمل داخل بيئة العمل بالكامل دون الحاجة لأي اتصال بالإنترنت")
            ]
            for idx, (title_f, desc_f) in enumerate(features):
                p_item = ease_out(prog(t, 2.1 + idx * 0.35, 0.4))
                x_slide = int((1.0 - p_item) * 100)
                cy = 960 + idx * 160
                draw_glass_card(im, draw, 80 + x_slide, cy - 65, W - 80, cy + 65, border_color=CARD_BORDER, radius=20)
                draw.text((W - 120, cy - 18), title_f, font=get_font(34), fill=GOLD_NEON, anchor="rm", direction="rtl")
                draw.text((W - 120, cy + 24), desc_f, font=get_font(23), fill=MUTED, anchor="rm", direction="rtl")

    # ─────────────────────────────────────────────────────────────
    # SCENE 2: Interactive Hardware Scanner Station (3.8s – 8.0s)
    # ─────────────────────────────────────────────────────────────
    elif t < 8.0:
        p_sc = ease_out(prog(t, 3.8, 0.45))
        y_sl = int((1.0 - p_sc) * 45)
        
        draw_badge(draw, "التقاط ذكي ومباشر ⚡", CX, 195 - y_sl, bg=(20, 50, 110), fg=CYAN_NEON, border=BLUE_NEON, font_size=28)
        draw.text((CX, 270 - y_sl), "مسح فوري من الطابعة والكاميرا", font=get_font(52), fill=WHITE, anchor="mm", direction="rtl")
        draw.text((CX, 330 - y_sl), "أرشفة المعاملات والمستندات الورقية في ثوانٍ", font=get_font(28), fill=MUTED, anchor="mm", direction="rtl")

        # Interactive Scanner Terminal Mockup (Card 1)
        p_card1 = ease_back(prog(t, 4.1, 0.5))
        y_c1 = int((1.0 - p_card1) * 60)
        draw_glass_card(im, draw, 70, 395 - y_c1, W - 70, 930 - y_c1, border_color=BLUE_NEON, radius=28, border_w=3)
        
        # Terminal top bar
        draw_badge(draw, "WIA Scanner Protocol", 230, 445 - y_c1, bg=(20, 45, 95), fg=WHITE, font_size=20)
        draw.text((W - 110, 445 - y_c1), "محطة المسح الضوئي المباشر 🖨️", font=get_font(36), fill=GOLD_LIGHT, anchor="rm", direction="rtl")

        # Live Simulated A4 Document with Scanning Laser Beam!
        doc_x0, doc_y0 = 110, 505 - y_c1
        doc_x1, doc_y1 = W - 110, 775 - y_c1
        draw.rounded_rectangle((doc_x0, doc_y0, doc_x1, doc_y1), radius=16, fill=(16, 28, 58), outline=(40, 70, 130), width=2)
        
        # Simulated lines of invoice document
        for li in range(5):
            ly = doc_y0 + 35 + li * 45
            draw.line([(doc_x0 + 40, ly), (doc_x1 - 40, ly)], fill=(70, 90, 140, 120), width=8)

        # Dynamic neon laser scan beam sweeping down!
        beam_progress = ((t - 3.8) * 0.8) % 1.0
        laser_y = int(doc_y0 + 20 + beam_progress * (doc_y1 - doc_y0 - 40))
        # Laser glow line
        draw.line([(doc_x0 + 15, laser_y), (doc_x1 - 15, laser_y)], fill=CYAN_NEON, width=4)
        draw.line([(doc_x0 + 30, laser_y), (doc_x1 - 30, laser_y)], fill=WHITE, width=2)
        
        # Scanned page counter indicator
        draw_badge(draw, "صفحة 1 من 4  •  دقة 300 DPI  •  ألوان كاملة", CX, 830 - y_c1, bg=(10, 35, 75), fg=GREEN_LIGHT, border=GREEN_NEON, font_size=22)
        draw.text((CX, 885 - y_c1), "دمج تلقائي لعدة صفحات في ملف PDF موثّق واحد", font=get_font(26), fill=WHITE, anchor="mm", direction="rtl")

        # Card 2: Camera Scan & ZXing Barcode
        p_card2 = ease_back(prog(t, 5.5, 0.5))
        y_c2 = int((1.0 - p_card2) * 60)
        draw_glass_card(im, draw, 70, 975 - y_c2, W - 70, 1515 - y_c2, border_color=GOLD_NEON, radius=28, border_w=3)
        
        draw_badge(draw, "ZXing AI Barcode Reader", 235, 1030 - y_c2, bg=(60, 45, 15), fg=GOLD_LIGHT, font_size=20)
        draw.text((W - 110, 1030 - y_c2), "مسح الكاميرا والتعرف على الباركود 📷", font=get_font(36), fill=WHITE, anchor="rm", direction="rtl")

        # Barcode recognition widget
        b_box_x0, b_box_y0 = 110, 1085 - y_c2
        b_box_x1, b_box_y1 = W - 110, 1270 - y_c2
        draw.rounded_rectangle((b_box_x0, b_box_y0, b_box_x1, b_box_y1), radius=16, fill=(20, 28, 48), outline=GREEN_NEON, width=2)
        
        # Barcode stripes simulation
        for bi in range(26):
            bx = b_box_x0 + 50 + bi * 32
            bw = 4 if bi % 3 == 0 else 2
            draw.line([(bx, b_box_y0 + 25), (bx, b_box_y1 - 65)], fill=(200, 220, 255), width=bw)
            
        draw.text((CX, b_box_y1 - 35), "كشف تلقائي: REF-2026-0984  |  تم استخراج الرقم المرجعي فوراً ✓", font=get_font(22), fill=GREEN_LIGHT, anchor="mm")

        # Features list under barcode
        f2_items = [
            ("✓ التقاط مباشر بكاميرا اللابتوب أو الجهاز دون ملحقات"),
            ("✓ ملء الحقول تلقائياً وتوجيه المستند للقسم والمجلد المختص"),
            ("✓ معاينة لحظية، تدوير، وضغط ذكي يقلل الحجم بنسبة 70%")
        ]
        for idx, itm in enumerate(f2_items):
            iy = 1325 + idx * 55 - y_c2
            draw.text((W - 120, iy), itm, font=get_font(25), fill=GOLD_LIGHT, anchor="rm", direction="rtl")

        draw_badge(draw, "⚡ اختصار 80% من وقت إدخال وأرشفة البيانات", CX, 1590, bg=(16, 50, 40), fg=GREEN_LIGHT, border=GREEN_NEON, font_size=26)

    # ─────────────────────────────────────────────────────────────
    # SCENE 3: OCR Intelligence & Security Audit (8.0s – 12.5s)
    # ─────────────────────────────────────────────────────────────
    elif t < 12.5:
        p_sc = ease_out(prog(t, 8.0, 0.45))
        y_sl = int((1.0 - p_sc) * 45)
        
        draw_badge(draw, "ذكاء اصطناعي محلي فائق 🧠", CX, 195 - y_sl, bg=(30, 40, 95), fg=CYAN_NEON, border=BLUE_NEON, font_size=28)
        draw.text((CX, 270 - y_sl), "محرك OCR يبحث داخل عمق المستندات", font=get_font(50), fill=WHITE, anchor="mm", direction="rtl")
        draw.text((CX, 330 - y_sl), "استخراج النصوص من الصور والـ PDF بالعربية والإنجليزية", font=get_font(27), fill=MUTED, anchor="mm", direction="rtl")

        # High-tech Animated Search Bar
        query_full = "بحث: \"عقد توريد معتمد — شركة الأفق\""
        chars = int(clamp(prog(t, 8.4, 1.3)) * len(query_full))
        typed = query_full[:chars] + ("|" if (int(t * 5) % 2 == 0 and t < 10.6) else "")
        
        draw_glass_card(im, draw, 80, 395, W - 80, 500, border_color=CYAN_NEON, radius=24, border_w=3)
        draw.text((W - 130, 448), "🔍", font=get_font(32), fill=CYAN_NEON, anchor="rm")
        draw.text((W - 185, 448), typed, font=get_font(30), fill=WHITE, anchor="rm", direction="rtl")
        draw_badge(draw, "استجابة 0.02s ⚡", 210, 448, bg=(15, 60, 45), fg=GREEN_LIGHT, font_size=20)

        # Card: OCR Engine Recognition Box simulation
        p_ocr = ease_back(prog(t, 9.4, 0.5))
        y_ocr = int((1.0 - p_ocr) * 50)
        draw_glass_card(im, draw, 70, 535 - y_ocr, W - 70, 1045 - y_ocr, border_color=BLUE_NEON, radius=28, border_w=2)
        
        draw.text((W - 110, 595 - y_ocr), "محرك Tesseract OCR عربي + إنجليزي 🌐", font=get_font(36), fill=GOLD_LIGHT, anchor="rm", direction="rtl")
        
        # Visual bounding boxes on detected text
        rec_box_y0 = 650 - y_ocr
        rec_box_y1 = 825 - y_ocr
        draw.rounded_rectangle((100, rec_box_y0, W - 100, rec_box_y1), radius=16, fill=(18, 30, 60), outline=(50, 80, 140), width=2)
        
        # Bounding box chips (simulating AI detection)
        detected_words = [
            ("عقد توريد معتمد", 780, 700 - y_ocr),
            ("رقم السجل: 10104829", 380, 700 - y_ocr),
            ("التاريخ: 2026/10/21", 780, 770 - y_ocr),
            ("الحالة: مطابق وموثق ✓", 380, 770 - y_ocr),
        ]
        for w_txt, bx, by in detected_words:
            draw_badge(draw, w_txt, bx, by, bg=(10, 45, 35), fg=GREEN_LIGHT, border=GREEN_NEON, font_size=22, pad_x=16, pad_y=8)

        draw.text((CX, 890 - y_ocr), "قراءة وفهرسة كاملة للنصوص داخل الصور وملفات PDF السكانر", font=get_font(26), fill=WHITE, anchor="mm", direction="rtl")
        draw.text((CX, 955 - y_ocr), "🔒 معالجة محلية 100% دون إرسال مستنداتك وسجلاتك لأي جهة خارجية", font=get_font(23), fill=MUTED, anchor="mm", direction="rtl")

        # Card: Enterprise Audit & Approvals
        p_sec = ease_back(prog(t, 10.6, 0.5))
        y_sec = int((1.0 - p_sec) * 50)
        draw_glass_card(im, draw, 70, 1080 - y_sec, W - 70, 1545 - y_sec, border_color=GOLD_NEON, radius=28, border_w=2)
        
        draw.text((W - 110, 1140 - y_sec), "دورة اعتمادات وسجل تدقيق صارم 🛡️", font=get_font(36), fill=WHITE, anchor="rm", direction="rtl")
        
        audit_bullets = [
            ("✅ دورة موافقات متكاملة", "طلب واعتماد ورفض المستندات مع إشعارات لحظية لفرق العمل"),
            ("📋 سجل تدقيق دقيق (Audit Trail)", "توثيق كل استعراض، تنزيل، رفع، أو تعديل بالوقت وهوية المستخدم"),
            ("🔐 أمان مؤسسي مشدد", "تشفير كلمات المرور scrypt مع صلاحيات دقيقة (مدير، مشرف، موظف)")
        ]
        for idx, (b_title, b_sub) in enumerate(audit_bullets):
            by = 1220 + idx * 100 - y_sec
            draw.text((W - 110, by), b_title, font=get_font(29), fill=GOLD_LIGHT, anchor="rm", direction="rtl")
            draw.text((W - 110, by + 34), b_sub, font=get_font(22), fill=MUTED, anchor="rm", direction="rtl")

        draw_badge(draw, "مطابق لأعلى معايير الحوكمة وإدارة الوثائق 🛡️", CX, 1610, bg=(20, 30, 60), fg=WHITE, border=BLUE_NEON, font_size=24)

    # ─────────────────────────────────────────────────────────────
    # SCENE 4: Real Dashboard UI & Desktop Power (12.5s – 16.5s)
    # ─────────────────────────────────────────────────────────────
    elif t < 16.5:
        p_sc = ease_out(prog(t, 12.5, 0.45))
        y_sl = int((1.0 - p_sc) * 45)
        
        draw_badge(draw, "واجهة العمل الحقيقية 📊", CX, 190 - y_sl, bg=(20, 50, 100), fg=CYAN_NEON, border=BLUE_NEON, font_size=28)
        draw.text((CX, 265 - y_sl), "لوحة مؤشرات تفاعلية شاملة", font=get_font(52), fill=WHITE, anchor="mm", direction="rtl")
        draw.text((CX, 325 - y_sl), "إحصاءات لحظية وتوزيع المعاملات حسب الأقسام والحالات", font=get_font(27), fill=MUTED, anchor="mm", direction="rtl")

        # Desktop Window Container
        win_w = W - 90
        win_h = 620
        wx0 = 45
        wy0 = 370
        
        # Outer glow border
        draw.rounded_rectangle((wx0 - 4, wy0 - 4, wx0 + win_w + 4, wy0 + win_h + 4), radius=22, fill=(10, 20, 45, 180), outline=CYAN_NEON, width=3)
        
        # Window header
        draw.rounded_rectangle((wx0, wy0, wx0 + win_w, wy0 + 48), radius=18, fill=(18, 32, 68))
        draw.ellipse((wx0 + 20, wy0 + 17, wx0 + 34, wy0 + 31), fill=(239, 68, 68))
        draw.ellipse((wx0 + 44, wy0 + 17, wx0 + 58, wy0 + 31), fill=(234, 179, 8))
        draw.ellipse((wx0 + 68, wy0 + 17, wx0 + 82, wy0 + 31), fill=(34, 197, 94))
        draw.text((wx0 + win_w - 30, wy0 + 24), "أرشيف — لوحة التحكم والإحصاءات الحية", font=get_font(22), fill=MUTED, anchor="rm", direction="rtl")

        # Paste Real Screenshot
        content_w = win_w
        content_h = win_h - 48
        shot_scaled = screenshot_raw.resize((content_w, content_h), Image.LANCZOS)
        im.paste(shot_scaled, (wx0, wy0 + 48))

        # Floating Glass Metric Chips over window edges
        draw_badge(draw, "⚡ محرك محلي فائق السرعة", 240, 960, bg=(10, 35, 75, 230), fg=WHITE, border=BLUE_NEON, font_size=22)
        draw_badge(draw, "📁 أكثر من 6,400 مستند مؤرشف", 840, 960, bg=(10, 45, 35, 230), fg=GREEN_LIGHT, border=GREEN_NEON, font_size=22)

        # 3 Desktop Advantage Cards below
        cards_s4 = [
            ("💻 تطبيق سطح مكتب متكامل (Windows x64)", "حزمة مدمجة بتقنية Electron تعمل بسرعة فائقة وثبات مطلق"),
            ("⚡ قاعدة بيانات SQLite محلية (LibSQL)", "استجابة فورية وحفظ مستمر دون تكاليف اشتراكات أو خوادم خارجية"),
            ("🌍 واجهة ثنائية (عربي RTL + إنجليزي LTR)", "تبديل فوري بضغطة زر واحدة في شريط النظام وشاشة الدخول")
        ]
        for idx, (c_head, c_sub) in enumerate(cards_s4):
            p_card = ease_back(prog(t, 13.2 + idx * 0.45, 0.4))
            x_off = int((1.0 - p_card) * 60)
            cy = 1080 + idx * 145
            draw_glass_card(im, draw, 70 + x_off, cy - 55, W - 70, cy + 55, border_color=CARD_BORDER, radius=20)
            draw.text((W - 105, cy - 16), c_head, font=get_font(30), fill=GOLD_LIGHT, anchor="rm", direction="rtl")
            draw.text((W - 105, cy + 22), c_sub, font=get_font(22), fill=WHITE, anchor="rm", direction="rtl")

        draw_badge(draw, "✅ تنصيب سريع وتشغيل فوري في دقيقتين فقط", CX, 1545, bg=(16, 50, 40), fg=GREEN_LIGHT, border=GREEN_NEON, font_size=26)

    # ─────────────────────────────────────────────────────────────
    # SCENE 5: Ultra-Clean High-Conversion Outro (16.5s – 21.0s)
    # ─────────────────────────────────────────────────────────────
    else:
        p_sc = ease_out(prog(t, 16.5, 0.45))
        y_sl = int((1.0 - p_sc) * 45)
        
        # Big Logo with Glowing Gold Halo
        p_logo = ease_back(prog(t, 16.7, 0.55))
        sz = int(210 * p_logo)
        if sz > 10:
            ic = icon_raw.resize((sz, sz), Image.LANCZOS)
            im.paste(ic, (CX - sz // 2, 320 - sz // 2), ic)
            
        draw.text((CX, 475 - y_sl), "نظام أرشيف — EDMS Archive", font=get_font(52), fill=GOLD_LIGHT, anchor="mm", direction="rtl")
        draw.text((CX, 540 - y_sl), "الحل المؤسسي المتكامل للأرشفة وإدارة الوثائق", font=get_font(29), fill=WHITE, anchor="mm", direction="rtl")
        
        # Giant Ultra-Clear Download Action Card
        draw_glass_card(im, draw, 65, 615, W - 65, 1435, border_color=GOLD_NEON, radius=32, border_w=3)
        
        draw_badge(draw, "مجاني ومفتوح المصدر بالكامل 🌟", CX, 685, bg=(30, 60, 130), fg=WHITE, border=BLUE_NEON, font_size=30, pad_x=32, pad_y=14)
        
        draw.text((CX, 780), "حمّل نسختك الآن لنظام ويندوز 64-بت", font=get_font(42), fill=WHITE, anchor="mm", direction="rtl")
        draw.text((CX, 845), "يدعم Windows 10 & 11 مع ترقية سلسة وتحديثات تلقائية", font=get_font(25), fill=MUTED, anchor="mm", direction="rtl")

        # Huge High-Contrast Download Link Banner with Pulsing Glow
        pulse_border = (245, 158, 11) if int(t * 3) % 2 == 0 else (6, 182, 212)
        draw.rounded_rectangle((100, 920, W - 100, 1220), radius=26, fill=(18, 38, 85), outline=pulse_border, width=3)
        
        draw_badge(draw, "⬇️ رابط التحميل المباشر", CX, 975, bg=(245, 158, 11), fg=(15, 23, 42), font_size=26, pad_x=28, pad_y=8)
        
        # Main requested link in HUGE BOLD text
        draw.text((CX, 1070), "zeidexsoft.com/programs", font=get_font(50), fill=WHITE, anchor="mm")
        draw.text((CX, 1150), "https://zeidexsoft.com/programs", font=get_font(30), fill=CYAN_NEON, anchor="mm")

        # Developer Signature & Seals
        draw.text((CX, 1295), "تطوير: ZeidexSoft  •  Ziad Al-hammadi", font=get_font(30), fill=GOLD_LIGHT, anchor="mm", direction="rtl")
        draw.text((CX, 1355), "منصة أرشفة إلكترونية عربية بمعايير عالمية", font=get_font(24), fill=MUTED, anchor="mm", direction="rtl")

        # Bottom share CTA
        draw_badge(draw, "احفظ الفيديو وشاركه مع فريقك 📲", CX, 1515, bg=(18, 25, 50), fg=WHITE, border=CYAN_NEON, font_size=28)
        draw.text((CX, 1600), "zeidexsoft.com  •  github.com/zeiad6/Edms-archive", font=get_font(24), fill=MUTED, anchor="mm")

    return im.convert("RGB")

def build_audio(out_audio_path):
    print("Building audio mix...")
    cmd = [
        "ffmpeg", "-y",
        "-ss", "0", "-t", str(DUR), "-i", MUSIC_PATH,
        "-i", os.path.join(SFX_DIR, "impact", "impactGeneric_light_000.ogg"),
        "-i", os.path.join(SFX_DIR, "interface", "switch_001.ogg"),
        "-i", os.path.join(SFX_DIR, "interface", "bong_001.ogg"),
        "-filter_complex",
        f"[0:a]afade=t=out:st=19.5:d=1.5,volume=0.85[m];"
        f"[1:a]adelay=100|100,volume=0.7[s0];"
        f"[2:a]adelay=3800|3800,volume=0.7[s1];"
        f"[2:a]adelay=8000|8000,volume=0.7[s2];"
        f"[2:a]adelay=12500|12500,volume=0.7[s3];"
        f"[3:a]adelay=16500|16500,volume=0.8[s4];"
        f"[m][s0][s1][s2][s3][s4]amix=inputs=6:duration=first:dropout_transition=2[aout]",
        "-map", "[aout]",
        "-c:a", "aac", "-b:a", "192k",
        out_audio_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Audio mix failed: {res.stderr}")
    print("Audio ready at:", out_audio_path)

def render_stills():
    stills_dir = os.path.join(HERE, "stills")
    os.makedirs(stills_dir, exist_ok=True)
    sample_times = [0.8, 2.6, 5.5, 10.0, 14.0, 18.5]
    for st in sample_times:
        print(f"Rendering still at t={st:.1f}s...")
        frame = render_frame(st)
        p = os.path.join(stills_dir, f"still_{st:04.1f}s.png")
        frame.save(p)
        print(f"Saved: {p}")

def render_video():
    os.makedirs(OUT, exist_ok=True)
    audio_wav = os.path.join(HERE, "audio.aac")
    build_audio(audio_wav)

    poster_path = os.path.join(OUT, "brag.jpg")
    print(f"Generating poster at t={POSTER_T}s...")
    poster_img = render_frame(POSTER_T)
    poster_img.save(poster_path, quality=95)
    print("Poster saved at:", poster_path)

    total_frames = int(DUR * FPS)
    final_video_path = os.path.join(OUT, "brag.mp4")

    print(f"Rendering {total_frames} frames to video with high quality...")
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{W}x{H}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-i", audio_wav,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "18",
        "-c:a", "copy",
        "-shortest",
        final_video_path
    ]
    
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    # Frame 0 is baked poster
    proc.stdin.write(poster_img.tobytes())

    for i in range(1, total_frames):
        t = i / FPS
        if i % 30 == 0:
            sys.stdout.write(f"\rProgress: frame {i}/{total_frames} ({t:.1f}s / {DUR:.1f}s)...")
            sys.stdout.flush()
        frame = render_frame(t)
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    stderr_out = proc.stderr.read().decode()
    proc.wait()
    sys.stdout.write("\n")

    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg encoding failed: {stderr_out}")

    print("Video rendered successfully to:", final_video_path)

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "video"
    if mode == "stills":
        render_stills()
    else:
        render_video()
