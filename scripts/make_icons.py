"""Genera los íconos de la PWA a partir del logo de Gladys Pérez (assets/logo-gladys-perez.jpg).
Uso: python3 scripts/make_icons.py"""
from PIL import Image

AZUL = (31, 79, 163)  # #1F4FA3, color del logo
logo = Image.open("assets/logo-gladys-perez.jpg").convert("RGB")
cuadro = logo.crop((578, 391, 1022, 835))  # cuadro blanco con "GP"


def icono(tam: int, proporcion: float) -> Image.Image:
    lienzo = Image.new("RGB", (tam, tam), AZUL)
    lado = round(tam * proporcion)
    pieza = cuadro.resize((lado, lado), Image.LANCZOS)
    lienzo.paste(pieza, ((tam - lado) // 2, (tam - lado) // 2))
    return lienzo


icono(192, 0.74).save("public/pwa-192.png", optimize=True)
icono(512, 0.74).save("public/pwa-512.png", optimize=True)
icono(512, 0.56).save("public/pwa-maskable-512.png", optimize=True)  # zona segura para Android
icono(180, 0.74).save("public/apple-touch-icon.png", optimize=True)
icono(64, 0.9).save("public/favicon.png", optimize=True)

# Logo completo (franja azul) para la pantalla de entrada
banda = logo.crop((0, 240, 1600, 1360)).resize((800, 560), Image.LANCZOS)
banda.convert("P", palette=Image.ADAPTIVE, colors=64).save("public/logo-gladys-perez.png", optimize=True)
print("ok")
