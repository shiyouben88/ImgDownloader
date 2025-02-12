// 监听来自 popup 页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getImages') {
    // 使用 Set 来存储唯一的图片指纹
    const uniqueImages = new Map();
    
    // 获取页面上所有图片元素并处理
    const images = Array.from(document.querySelectorAll('img')).map(img => {
      let src = img.src;
      let originalFormat = '';
      
      // 处理Instagram图片URL
      if (window.location.hostname.includes('instagram.com')) {
        // 尝试获取原始图片URL，通过srcset获取最高分辨率的图片
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
      
      // 处理图片URL格式和参数
      const url = new URL(src);
      const pathname = url.pathname;
      const searchParams = url.searchParams;
      
      // 检查URL路径中的图片格式
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
        format: originalFormat || 'jpg'
      };
    }).filter(img => img.src);

    // 获取背景图片
    const bgImages = Array.from(document.querySelectorAll('*')).reduce((acc, el) => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      
      if (bgImage && bgImage !== 'none') {
        const matches = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (matches) {
          const src = matches[1];
          let originalFormat = '';
          
          try {
            const url = new URL(src, window.location.href);
            const pathname = url.pathname;
            const formatMatch = pathname.match(/\.(jpg|jpeg|png|gif|webp|avif)(\!|\?|$)/i);
            if (formatMatch) {
              originalFormat = formatMatch[1].toLowerCase();
            }
            
            acc.push({
              src: src,
              width: el.offsetWidth || 0,
              height: el.offsetHeight || 0,
              format: originalFormat || 'jpg'
            });
          } catch (e) {
            console.error('Error parsing background image URL:', e);
          }
        }
      }
      return acc;
    }, []);
    
    // 合并普通图片和背景图片
    const allImages = [...images, ...bgImages];
    
    // 对图片进行去重处理
    allImages.forEach(img => {
      // 使用尺寸和URL的最后部分作为指纹
      const urlPath = new URL(img.src).pathname;
      const fingerprint = `${img.width}x${img.height}_${urlPath.split('/').pop()}`;
      
      // 如果已存在相同指纹的图片，保留分辨率更高的版本
      if (!uniqueImages.has(fingerprint) || 
          (img.width * img.height) > (uniqueImages.get(fingerprint).width * uniqueImages.get(fingerprint).height)) {
        uniqueImages.set(fingerprint, img);
      }
    });
    
    // 将去重后的图片信息转换回数组并返回
    const uniqueImagesArray = Array.from(uniqueImages.values());
    sendResponse({images: uniqueImagesArray});
  }
  return true; // 保持消息通道开启
});