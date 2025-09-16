const cloud = require('wx-server-sdk');
cloud.init({ env: "cloud1-1grapwhzb010af67" });

function extractUrlInfo(url) {
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    const urlObj = new URL(normalizedUrl);
    return {
      normalizedUrl,
      hostname: urlObj.hostname.toLowerCase(),
      pathname: urlObj.pathname,
      search: urlObj.search
    };
  } catch (err) {
    console.error('URL解析错误:', err);
    return null;
  }
}

async function getVideoMetadata(url) {
  try {
    return { title: `视频(${new Date().toLocaleString()})` };
  } catch (err) {
    console.error('获取视频元信息失败:', err);
    return { title: '未知视频' };
  }
}

// 新增：生成各平台的正确播放链接
function generatePlayUrl(platform, urlInfo, videoId) {
  switch(platform) {
    case 'bilibili':
      // B站需要使用embed播放器链接才能在web-view中正常播放
      return `https://player.bilibili.com/player.html?bvid=${videoId}&page=1&as_wide=1&high_quality=1&danmaku=0`;
      
    case 'douyin':
      // 抖音视频需要处理为embed格式
      return `https://www.douyin.com/video/${videoId}`;
      
    case 'tencent':
      // 腾讯视频播放链接处理
      return `https://v.qq.com/x/cover/${videoId}.html`;
      
    default:
      return urlInfo.normalizedUrl;
  }
}

exports.main = async (event, context) => {
  try {
    console.log('收到解析请求:', event);
    const { videoUrl } = event;
    
    if (!videoUrl) {
      return { success: false, message: '请输入视频链接' };
    }
    
    const urlInfo = extractUrlInfo(videoUrl);
    if (!urlInfo) {
      return { success: false, message: '无效的URL格式' };
    }
    
    let platform, result, metadata;
    metadata = await getVideoMetadata(urlInfo.normalizedUrl);
    
    // B站视频处理
    if (urlInfo.hostname.includes('bilibili') || urlInfo.hostname.includes('b23.tv')) {
      platform = 'bilibili';
      // 提取 BV 号（支持带参数的链接）
      let bvMatch = urlInfo.normalizedUrl.match(/BV[0-9A-Za-z]+/);
      // 若直接匹配失败，从路径中分割提取
      if (!bvMatch) {
        const pathParts = urlInfo.pathname.split('/');
        for (const part of pathParts) {
          if (part.startsWith('BV')) {
            bvMatch = [part];
            break;
          }
        }
      }
      if (!bvMatch) {
        return {
          success: false,
          message: '未找到 B 站视频编号 (BV)'
        };
      }
      const videoId = bvMatch[0];
      result = {
        success: true,
        platform,
        title: `B站视频 ${videoId}`,
        videoId,
        // 生成 B 站专用播放链接（适配 web-view）
        webUrl: `https://player.bilibili.com/player.html?bvid=${videoId}`,
        realPlayUrl: `https://player.bilibili.com/player.html?bvid=${videoId}`,
        originalUrl: videoUrl
      };
    }
    // 抖音视频处理
    else if (urlInfo.hostname.includes('douyin') || urlInfo.hostname.includes('iesdouyin')) {
      platform = 'douyin';
      let itemIdMatch = urlInfo.search.match(/item_id=(\d+)/);
      let videoIdMatch = urlInfo.pathname.match(/(\d+)\.html/);
      
      if (!itemIdMatch && !videoIdMatch) {
        return { success: false, message: '未找到抖音视频ID' };
      }
      
      const videoId = itemIdMatch ? itemIdMatch[1] : videoIdMatch[1];
      const playUrl = generatePlayUrl(platform, urlInfo, videoId);
      
      result = {
        success: true,
        platform,
        title: metadata.title || '抖音视频',
        videoId,
        webUrl: urlInfo.normalizedUrl,
        realPlayUrl: playUrl,
        originalUrl: videoUrl
      };
    }
    // 腾讯视频处理
    else if (urlInfo.hostname.includes('v.qq.com')) {
      platform = 'tencent';
      let vidMatch = urlInfo.search.match(/vid=([^&]+)/);
      if (!vidMatch) {
        return { success: false, message: '未找到腾讯视频ID' };
      }
      
      const videoId = vidMatch[1];
      const playUrl = generatePlayUrl(platform, urlInfo, videoId);
      
      result = {
        success: true,
        platform,
        title: metadata.title || '腾讯视频',
        videoId,
        webUrl: urlInfo.normalizedUrl,
        realPlayUrl: playUrl,
        originalUrl: videoUrl
      };
    }
    // 通用视频链接(直接播放格式)
    else if (['.mp4', '.mov', '.avi', '.flv', '.m3u8'].some(ext => 
      urlInfo.pathname.toLowerCase().endsWith(ext)
    )) {
      platform = 'general';
      result = {
        success: true,
        platform,
        title: metadata.title || '通用视频',
        videoId: Date.now().toString(),
        webUrl: urlInfo.normalizedUrl,
        realPlayUrl: urlInfo.normalizedUrl,
        originalUrl: videoUrl
      };
    }
    // 未知平台
    else {
      return {
        success: false,
        message: `暂不支持该平台: ${urlInfo.hostname}`
      };
    }
    
    console.log('解析成功:', result);
    return result;
  } catch (err) {
    console.error('视频解析错误:', err);
    return {
      success: false,
      message: `解析失败: ${err.message || '未知错误'}`,
      error: err.stack
    };
  }
};
