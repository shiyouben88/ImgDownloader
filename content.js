chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getImages') {
    // 使用 Set 来存储唯一的图片指纹
    const uniqueImages = new Map();
    
    const images = Array.from(document.querySelectorAll('img')).map(img => {
      let src = img.src;
      let originalFormat = '';
      
      // 处理Instagram图片URL
      if (window.location.hostname.includes('instagram.com')) {
        // 尝试获取原始图片URL
        const srcset = img.srcset;
        if (srcset) {
          const sources = srcset.split(',').map(s => s.trim().split(' '));
          const highestRes = sources.reduce((acc, curr) => {
            const width = parseInt(curr[1]);
            return width > acc.width ? {url: curr[0], width} : acc;
          }, {url: '', width: 0});
          if (highestRes.url) {
            src = highestRes.url;
          }
        }
      }
      
      // 处理webp格式和特殊URL参数
      const url = new URL(src);
      const pathname = url.pathname;
      const searchParams = url.searchParams;
      
      // 检查URL路径中的格式
      const formatMatch = pathname.match(/\.(jpg|jpeg|png|gif|webp|avif)(\!|\?|$)/i);
      if (formatMatch) {
        originalFormat = formatMatch[1].toLowerCase();
      }
      
      // 处理特殊的URL参数格式（如小红书的webp参数）
      if (searchParams.has('webp') || pathname.includes('_webp') || pathname.includes('_webp_mw')) {
        originalFormat = 'webp';
      }
      
      return {
        src: src,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        format: originalFormat || 'jpg' // 如果无法检测到格式，默认使用jpg
      };
    }).filter(img => img.src); // 只过滤掉无效的图片，尺寸过滤放到popup.js中处理
    
    // 对图片进行去重
    images.forEach(img => {
      // 使用尺寸和URL的最后部分作为指纹
      const urlPath = new URL(img.src).pathname;
      const fingerprint = `${img.width}x${img.height}_${urlPath.split('/').pop()}`;
      
      // 如果已存在相同指纹的图片，保留分辨率更高的版本
      if (!uniqueImages.has(fingerprint) || 
          (img.width * img.height) > (uniqueImages.get(fingerprint).width * uniqueImages.get(fingerprint).height)) {
        uniqueImages.set(fingerprint, img);
      }
    });
    
    // 转换回数组
    const uniqueImagesArray = Array.from(uniqueImages.values());
    
    sendResponse({images: uniqueImagesArray});
  }
  return true;
});