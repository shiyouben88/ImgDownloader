let downloadQueue = [];
let isDownloading = false;

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const urlParts = downloadItem.url.split('/');
  const fileName = urlParts[urlParts.length - 1].split('?')[0];
  const extension = fileName.split('.').pop().toLowerCase();
  
  const pageTitle = downloadItem.pageTitle || 'untitled';
  const sanitizedTitle = sanitizeFileName(pageTitle);
  const imageName = sanitizeFileName(fileName.split('.')[0]);
  const newFileName = `${sanitizedTitle}_${imageName}.${extension}`;
  
  suggest({ filename: newFileName });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'queueDownloads') {
    const downloads = request.urls.map(item => ({
      url: item.url || item,
      pageTitle: item.pageTitle || 'untitled'
    }));
    
    downloadQueue = downloadQueue.concat(downloads);
    startDownload();
    sendResponse({ success: true });
  }
});

async function startDownload() {
  if (isDownloading || downloadQueue.length === 0) return;
  
  isDownloading = true;
  
  while (downloadQueue.length > 0) {
    const downloadInfo = downloadQueue.shift();
    await downloadImage(downloadInfo.url, downloadInfo.pageTitle);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  isDownloading = false;
}

async function downloadImage(url, pageTitle) {
  const extension = getFileExtension(url);
  const sanitizedTitle = sanitizeFileName(pageTitle || 'untitled');
  const imageName = sanitizeFileName(getImageNameFromUrl(url));
  const filename = `${sanitizedTitle}/${imageName}.${extension}`;
  
  return new Promise((resolve, reject) => {
    const downloadOptions = {
      url: url,
      filename: filename,
      conflictAction: 'uniquify',
      saveAs: false
    };
    
    try {
      chrome.downloads.download(downloadOptions, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (downloadId === undefined) {
          reject(new Error('下载失败：未获取到下载ID'));
          return;
        }
        
        chrome.downloads.onChanged.addListener(function onChanged(delta) {
          if (delta.id === downloadId) {
            if (delta.state && delta.state.current === 'complete') {
              chrome.downloads.onChanged.removeListener(onChanged);
              resolve(downloadId);
            } else if (delta.error) {
              chrome.downloads.onChanged.removeListener(onChanged);
              reject(new Error(`下载失败: ${delta.error.current}`));
            }
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

function getFileExtension(url) {
  if (url.includes('.webp') || url.includes('image/webp')) {
    return 'webp';
  }
  
  const urlExtension = url.split('.').pop().split('?')[0].toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(urlExtension) ? urlExtension : 'jpg';
}

function getImageNameFromUrl(url) {
  const urlParts = url.split('/');
  return urlParts[urlParts.length - 1].split('?')[0].split('.')[0];
}

function sanitizeFileName(name) {
  return name
    .replace(/[/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .trim() || 'untitled';
}