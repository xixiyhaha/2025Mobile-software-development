// 练歌房功能
Page({
    data: {
      song: null,          // 当前歌曲信息
      currentSentence: 0,  // 当前练习的句子索引
      lyrics: [],          // 歌词数组
      isRecording: false,  // 是否正在录音
      recordedSegments: [], // 已录制的片段
      practiceMode: 'sentence', // 练习模式: sentence/section/full
      sections: [],        // 歌曲分段
      currentSection: 0,   // 当前段落
      videos: []           // 相关学习视频
    },
  
    onLoad(options) {
      const songId = options.songId;
      // 获取歌曲详情
      this.getSongDetail(songId);
      // 获取该歌曲的学习视频
      this.getRelatedVideos(songId);
    },
  
    // 获取歌曲详情
    getSongDetail(songId) {
      // 实际开发中这里会调用云函数或API获取数据
      wx.cloud.callFunction({
        name: 'getSongDetail',
        data: { songId }
      }).then(res => {
        this.setData({
          song: res.result,
          lyrics: res.result.lyrics,
          sections: res.result.sections
        });
      });
    },
  
    // 获取相关学习视频
    getRelatedVideos(songId) {
      wx.cloud.callFunction({
        name: 'getRelatedVideos',
        data: { songId }
      }).then(res => {
        this.setData({
          videos: res.result
        });
      });
    },
  
    // 开始录音
    startRecording() {
      this.setData({ isRecording: true });
      this.recorderManager = wx.getRecorderManager();
      
      // 添加错误监听
      this.recorderManager.onError((err) => {
        console.error('录音错误:', err);
        wx.showToast({ title: '录音失败', icon: 'none' });
        this.setData({ isRecording: false });
      });
      
      const options = {
        duration: 60000, // 最长录音时间
        sampleRate: 44100,
        numberOfChannels: 1,
        encodeBitRate: 192000,
        format: 'mp3'
      };
      
      this.recorderManager.start(options);
    },
  
    // 停止录音
    stopRecording() {
      this.setData({ isRecording: false });
      this.recorderManager.stop();
      
      this.recorderManager.onStop(res => {
        const tempFilePath = res.tempFilePath;
        // 保存当前句子的录音
        this.saveRecording(tempFilePath);
      });
    },
  
    // 保存录音
    saveRecording(filePath) {
      const { recordedSegments, currentSentence } = this.data;
      recordedSegments[currentSentence] = filePath;
      
      this.setData({ recordedSegments });
      
      // 保存到云端
      this.uploadRecording(filePath, currentSentence);
    },
  
    // 上传录音到云端
    uploadRecording(filePath, sentenceIndex) {
      const songId = this.data.song.songId;
      const cloudPath = `recordings/${wx.getStorageSync('userId')}/${songId}/${sentenceIndex}.mp3`;
      
      wx.cloud.uploadFile({
        cloudPath,
        filePath: filePath // 直接使用临时文件路径
      }).then(res => {
        console.log('录音上传成功', res.fileID);
      });
    },
  
    // 切换到下一句
    nextSentence() {
      const { currentSentence, lyrics } = this.data;
      if (currentSentence < lyrics.length - 1) {
        this.setData({ currentSentence: currentSentence + 1 });
      }
    },
  
    // 切换到上一句
    prevSentence() {
      const { currentSentence } = this.data;
      if (currentSentence > 0) {
        this.setData({ currentSentence: currentSentence - 1 });
      }
    },
  
    // 切换练习模式
    switchMode(mode) {
      this.setData({ practiceMode: mode });
    },
  
    // 导入学习视频
    importVideo() {
      const that = this;
      wx.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back',
        success(res) {
          const tempFilePath = res.tempFilePath;
          that.uploadVideo(tempFilePath);
        }
      });
    },
  
    // 上传视频
    uploadVideo(filePath) {
      const songId = this.data.song.songId;
      const timestamp = new Date().getTime();
      // 确保songId和userId存在且格式合法
      if (!songId || !wx.getStorageSync('userId')) {
        wx.showToast({ title: '参数错误，无法上传', icon: 'none' });
        return;
      }
      // 生成文件名（避免非法字符）
      const fileName = `${timestamp}.mp4`.replace(/[\\/:*?"<>| ]/g, '_');
      // 规范化路径（避免连续斜杠）
      const cloudPath = `videos/${wx.getStorageSync('userId')}/${songId}/${fileName}`
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/+/g, '/');
      
      wx.cloud.uploadFile({
        cloudPath,
        fileContent: Buffer.from(filePath)
      }).then(res => {
        console.log('视频上传成功', res.fileID);
        // 后续逻辑...
      }).catch(err => {
        console.error('视频上传失败', err);
        wx.showToast({ title: '上传失败，路径格式错误', icon: 'none' });
      });
    }
  })
  