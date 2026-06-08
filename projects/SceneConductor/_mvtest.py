from playwright.sync_api import sync_playwright
import json

URL = "http://localhost:8000/index.html"
with sync_playwright() as p:
    # enable software WebGL so model-viewer can actually parse+render in headless
    browser = p.chromium.launch(headless=True, args=[
        "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
    ])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    msgs = []
    page.on("console", lambda m: msgs.append((m.type, m.text)))
    page.on("pageerror", lambda e: msgs.append(("pageerror", e.message)))
    page.goto(URL, wait_until="load", timeout=60000)
    page.wait_for_timeout(2000)
    # scroll the stage viewers into view so model-viewer actually fetches+decodes them
    page.evaluate("document.getElementById('viewer-stack')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(12000)

    state = page.evaluate(
        """async () => {
            const ids = ['viewer-stage1','viewer-stage2','viewer-stage3'];
            const out = {};
            for (const id of ids) {
              const mv = document.getElementById(id);
              if (!mv) { out[id] = 'no-el'; continue; }
              out[id] = { loaded: mv.loaded, modelIsVisible: mv.modelIsVisible, src: mv.getAttribute('src') };
            }
            return out;
        }"""
    )
    print("MODEL-VIEWER STATE:")
    print(json.dumps(state, indent=2, ensure_ascii=False))

    print("\nGLB / three.js / model-viewer related console messages:")
    seen = set()
    for t, m in msgs:
        if any(k in m.lower() for k in ["primitive","instanc","draco","glb","gltf","decode","webgl error","three"]) or t == "pageerror":
            key = (t, m[:80])
            if key in seen: continue
            seen.add(key)
            print(f"  [{t}] {m[:240]}")

    # screenshot the stage viewer area
    try:
        page.locator("#viewer-stack").screenshot(path="_mv.png")
        print("\nsaved _mv.png")
    except Exception as e:
        print("shot fail:", e)
    browser.close()
