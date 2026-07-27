function roundedRect(context, x, y, width, height, radius) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - resolvedRadius,
    y + height
  );
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function fillRoundedRect(context, x, y, width, height, radius, fillStyle) {
  roundedRect(context, x, y, width, height, radius);
  context.setFillStyle(fillStyle);
  context.fill();
}

function centeredText(context, text, x, y, fontSize, color, bold = false) {
  context.setTextAlign("center");
  context.setTextBaseline("middle");
  context.setFillStyle(color);
  context.setFontSize(fontSize);
  if (typeof context.font === "string") {
    context.font = `${bold ? "700 " : ""}${fontSize}px sans-serif`;
  }
  context.fillText(String(text), x, y);
}

function leftText(context, text, x, y, fontSize, color, bold = false) {
  context.setTextAlign("left");
  context.setTextBaseline("middle");
  context.setFillStyle(color);
  context.setFontSize(fontSize);
  if (typeof context.font === "string") {
    context.font = `${bold ? "700 " : ""}${fontSize}px sans-serif`;
  }
  context.fillText(String(text), x, y);
}

function posterSize(heightRatio = 1.28) {
  const info =
    typeof wx.getWindowInfo === "function" ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const width = Math.round(Math.min(390, info.windowWidth - 40));
  return { width, height: Math.round(width * heightRatio) };
}

function exportCanvas(page, canvasId, width, height) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath(
      {
        canvasId,
        width,
        height,
        destWidth: width * 2,
        destHeight: height * 2,
        fileType: "png",
        quality: 1,
        success: (result) => resolve(result.tempFilePath),
        fail: () => reject(new Error("海报生成失败，请稍后重试"))
      },
      page
    );
  });
}

function savePoster(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail(error) {
        if (error && String(error.errMsg || "").includes("auth deny")) {
          wx.showModal({
            title: "需要相册权限",
            content: "请在设置中允许保存图片，才能把学习海报保存到相册。",
            confirmText: "去设置",
            success(result) {
              if (result.confirm) wx.openSetting();
            }
          });
        }
        reject(new Error("图片未保存"));
      }
    });
  });
}

module.exports = {
  centeredText,
  exportCanvas,
  fillRoundedRect,
  leftText,
  posterSize,
  savePoster
};
