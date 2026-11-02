const palettes = [
  {
    name: "落日橙",
    bg: "#f2e8d8",
    ink: "#e37a39",
    accent: "#5c352b",
    type: "orbit",
  },
  {
    name: "深海蓝",
    bg: "#101e36",
    ink: "#245e88",
    accent: "#80c3d7",
    type: "waves",
  },
  {
    name: "山间绿",
    bg: "#e3eadb",
    ink: "#8baf8a",
    accent: "#294e45",
    type: "hills",
  },
  {
    name: "暮色紫",
    bg: "#241e3d",
    ink: "#80648e",
    accent: "#e7a99d",
    type: "orbit",
  },
  {
    name: "沙丘白",
    bg: "#f3eee4",
    ink: "#dac7ad",
    accent: "#a3866e",
    type: "waves",
  },
  {
    name: "极简黑",
    bg: "#161819",
    ink: "#272c30",
    accent: "#657074",
    type: "grid",
  },
];

function draw(canvas, palette) {
  const ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);
  if (palette.type === "orbit") {
    const gradient = ctx.createLinearGradient(0, h * 0.12, w, h);
    gradient.addColorStop(0, palette.ink);
    gradient.addColorStop(1, palette.accent);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.48, h * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(1, w / 1400);
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(
        w * 0.54,
        h * 0.53,
        w * (0.38 + i * 0.035),
        h * (0.1 + i * 0.02),
        -0.32,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.bg;
    ctx.beginPath();
    ctx.arc(w * 0.32, h * 0.75, h * 0.23, 0, Math.PI * 2);
    ctx.fill();
  } else if (palette.type === "hills" || palette.type === "waves") {
    for (let layer = 0; layer < 5; layer++) {
      ctx.fillStyle = layer < 3 ? palette.ink : palette.accent;
      ctx.globalAlpha = 0.28 + layer * 0.13;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += w / 200) {
        const y =
          h * (0.35 + layer * 0.13) +
          Math.sin(
            (x / w) * Math.PI * (palette.type === "hills" ? 2 : 1.4) +
              layer * 0.8,
          ) *
            h *
            0.12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = Math.max(1, w / 1600);
    for (let x = 0; x < w; x += w / 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += w / 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(
      w * 0.65,
      h * 0.45,
      0,
      w * 0.65,
      h * 0.45,
      h * 0.7,
    );
    glow.addColorStop(0, palette.accent + "44");
    glow.addColorStop(1, palette.accent + "00");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}

export async function saveCanvas(canvas, filename) {
  const blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("图片生成失败，请重试。")),
        "image/png",
      );
    } catch (error) {
      reject(error);
    }
  });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initWallpaper(tell) {
  let selected = 0;
  const canvas = document.getElementById("wallpaper-canvas");
  const options = document.getElementById("wallpaper-styles");
  function paint() {
    draw(canvas, palettes[selected]);
    [...options.children].forEach((button, index) =>
      button.setAttribute("aria-pressed", String(index === selected)),
    );
  }
  for (const [index, palette] of palettes.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "style-option";
    const swatch = document.createElement("span");
    swatch.style.background = `linear-gradient(135deg, ${palette.bg}, ${palette.ink})`;
    swatch.setAttribute("aria-hidden", "true");
    button.append(swatch, palette.name);
    button.addEventListener("click", () => {
      selected = index;
      paint();
    });
    options.append(button);
  }
  document
    .getElementById("download-wallpaper")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const [width, height] = document
          .getElementById("wallpaper-size")
          .value.split("x")
          .map(Number);
        const output = document.createElement("canvas");
        output.width = width;
        output.height = height;
        draw(output, palettes[selected]);
        await saveCanvas(
          output,
          `stmh-wallpaper-${selected + 1}-${width}x${height}.png`,
        );
        tell("壁纸已生成，请查看浏览器下载。");
      } catch (error) {
        tell(error.message);
      } finally {
        button.disabled = false;
      }
    });
  paint();
}
