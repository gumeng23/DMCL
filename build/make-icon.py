from PIL import Image, ImageDraw, ImageFilter
import math

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# Rounded background with a soft vertical gradient.
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
px = bg.load()
for y in range(S):
    t = y / (S - 1)
    r = int(10 + 6 * t)
    g = int(18 + 16 * t)
    b = int(17 + 12 * t)
    for x in range(S):
        px[x, y] = (r, g, b, 255)
mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle((28, 28, S - 28, S - 28), radius=210, fill=255)
img.alpha_composite(Image.composite(bg, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))
d = ImageDraw.Draw(img)

# Outline
d.rounded_rectangle((28, 28, S - 28, S - 28), radius=210, outline=(168, 244, 95, 65), width=5)
d.rounded_rectangle((48, 48, S - 48, S - 48), radius=192, outline=(255, 255, 255, 18), width=2)

# Warm green glow behind cube.
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((220, 230, 804, 814), fill=(142, 232, 78, 70))
glow = glow.filter(ImageFilter.GaussianBlur(100))
img.alpha_composite(glow)

# Isometric cube.
top = [(512, 232), (772, 382), (512, 532), (252, 382)]
left = [(252, 382), (512, 532), (512, 824), (252, 674)]
right = [(772, 382), (512, 532), (512, 824), (772, 674)]
# Subtle shadow under the cube.
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.ellipse((300, 742, 724, 878), fill=(0, 0, 0, 130))
shadow = shadow.filter(ImageFilter.GaussianBlur(40))
img.alpha_composite(shadow)

d.polygon(left, fill=(51, 112, 55, 255))
d.polygon(right, fill=(92, 169, 69, 255))
d.polygon(top, fill=(186, 250, 119, 255))
# Top highlight strips.
d.polygon([(512, 232), (772, 382), (740, 400), (512, 268)], fill=(219, 255, 163, 255))
d.polygon([(512, 268), (740, 400), (512, 520), (284, 400)], fill=(171, 236, 99, 255))
# Left face shading.
d.polygon([(252, 382), (512, 532), (512, 590), (252, 440)], fill=(43, 94, 48, 255))
d.polygon([(252, 674), (512, 824), (512, 824), (252, 674)], fill=(34, 76, 40, 255))
# Right face highlight.
d.polygon([(512, 532), (772, 382), (772, 430), (512, 580)], fill=(119, 198, 87, 255))
# Pixel notch on left.
d.rectangle((314, 506, 390, 552), fill=(77, 142, 68, 255))
d.rectangle((338, 526, 366, 552), fill=(111, 180, 84, 255))
# Edge lines.
d.line(top + [top[0]], fill=(230, 255, 188, 180), width=4)
d.line(left + [left[0]], fill=(23, 58, 30, 200), width=4)
d.line(right + [right[0]], fill=(35, 79, 38, 220), width=4)
# Sparkles.
for cx, cy, r, a in [(220, 250, 9, 170), (810, 262, 6, 130), (836, 700, 8, 100), (196, 648, 5, 130), (842, 476, 4, 110)]:
    d.polygon([(cx, cy-r), (cx+r, cy), (cx, cy+r), (cx-r, cy)], fill=(190, 255, 126, a))

img.save("build/icon.png", "PNG")
img.save("build/icon.ico", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("icons written")
