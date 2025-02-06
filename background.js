// 下载队列和状态管理
let downloadQueue = [];
let isDownloading = false;

// 监听来自 popup 的下载请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'queueDownloads') {
    console.log('接收到下载请求，队列项数:', request.urls.length);
    console.log('第一个下载项的页面标题:', request.urls[0].pageTitle);
    // 将新的下载任务添加到队列中
    downloadQueue = downloadQueue.concat(request.urls.map(item => ({
      url: item.url || item,
      pageTitle: item.pageTitle || 'untitled'
    })));
    startDownload();
    sendResponse({ success: true });
  }
});

/**
 * 开始处理下载队列
 * 确保同一时间只有一个下载任务在进行
 */
async function startDownload() {
  if (isDownloading || !downloadQueue.length) return;
  isDownloading = true;
  console.log('开始处理下载队列，队列长度:', downloadQueue.length);
  
  while (downloadQueue.length) {
    const { url, pageTitle } = downloadQueue.shift();
    console.log('处理下载项 - URL:', url);
    console.log('处理下载项 - 页面标题:', pageTitle);
    await downloadImage(url, pageTitle);
    // 添加延迟以避免过快触发下载
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  isDownloading = false;
}

/**
 * 下载单个图片
 * @param {string} url - 图片URL
 * @param {string} pageTitle - 页面标题，用于创建文件夹
 * @returns {Promise} 返回下载任务的Promise
 */
async function downloadImage(url, pageTitle) {
  try {
    const timestamp = new Date().getTime();
    let extension;
    
    // 智能判断文件扩展名
    if (url.includes('.webp') || url.includes('image/webp')) {
      extension = 'webp';
    } else {
      const urlExtension = url.split('.').pop().split('?')[0].toLowerCase();
      extension = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(urlExtension) ? urlExtension : 'jpg';
    }
    
    // 从 URL 中提取原始文件名
    const urlObj = new URL(url);
    const originalFileName = urlObj.pathname.split('/').pop().split('.')[0] || 'unnamed_image';
    
    // 处理 pageTitle，移除不合法的文件名字符，添加兜底值
    const sanitizedTitle = sanitizeFileName(pageTitle);
    
    // 文件命名格式：页面标题_原始文件名_时间戳.扩展名
    const filename = `${sanitizedTitle}_${originalFileName}_${timestamp}.${extension}`;
    
    console.log('Downloading with filename:', filename);  // 添加日志
    
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: filename,
        conflictAction: 'uniquify'  // 添加此选项以处理文件名冲突
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
  } catch (error) {
    console.error('Error in downloadImage:', error);
    throw error;
  }
}

/**
 * 清理文件名，移除不合法字符
 * @param {string} name - 原始文件名
 * @returns {string} 处理后的文件名
 */
function sanitizeFileName(name) {
  if (!name || name.trim() === '') {
    return 'no_title_page';  // 兜底值
  }
  
  return name
    .replace(/[\\/:*?"<>|]/g, '_')  // 替换Windows不允许的文件名字符
    .replace(/\s+/g, '_')           // 替换空白字符为下划线
    .trim() || 'no_title_page';     // 如果处理后为空，使用兜底值
}