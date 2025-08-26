# 2025年夏季《移动软件开发》实验报告



<center>姓名：邓林  学号：23020007014</center>

| 姓名和学号           | 邓林，23020007014                                            |
| -------------------- | ------------------------------------------------------------ |
| 本实验属于哪门课程？ | 中国海洋大学25夏《移动软件开发》                             |
| 实验名称？           | 实验1：第一个微信小程序                                      |
| 博客地址？           | [2025年夏季《移动软件开发》实验报告一-CSDN博客](https://blog.csdn.net/2302_80269321/article/details/150780431?sharetype=blogdetail&sharerId=150780431&sharerefer=PC&sharesource=2302_80269321&spm=1011.2480.3001.8118) |
| Github仓库地址？     | https://github.com/xixiyhaha/2025Mobile-software-development.git |

（备注：将实验报告发布在博客、代码公开至 github 是 **加分项**，不是必须做的）



## **一、实验目标**

1、学习使用快速启动模板创建小程序的方法；

2、学习不使用模板手动创建小程序的方法。



## 二、实验步骤

列出实验的关键步骤、代码解析、截图。

1、在微信公众平台注册小程序账号获取App ID；

2、下载微信开发者工具，登录；

3、点击”+“号创建新的小程序，设定项目名称、目录、AppID等；

![image-20250825184218637](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825184218637.png)

4、快速启动模板创建小程序在创建后就已经完成，可以看到点击编译后后模拟器已经显示出登陆界面样式。

![image-20250825173229418](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825173229418.png)

5、不使用模板手动创建小程序需要在新建小程序后，删除所有文件；

6、新建框架，并在pages文件新建page页，这样可以自动生成代码逻辑框架；

![image-20250825185234983](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825185234983.png)

7、新建文件夹images存放图片素材；

8、配置全局app.json，它负责标题栏和一些状态栏，我们可以设置窗口颜色、标题；

![image-20250825190624647](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825190624647.png)

9、接着我们配置index页的元素：头像、名称、按钮，为每一个元素设置变量，视图命名为container；

![image-20250825192618807](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825192618807.png)

10、在index.wxss界面设置页面排布：设置高度、垂直居中排列，图片大小、形状，文本大小等；

![image-20250825193056164](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825193056164.png)

11、在jindex.js中进行页面逻辑实现：设置变量name、src；

![image-20250825193306638](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825193306638.png)

12、同时添加获取用户信息函数，使得点击按钮能同时获得用户头像和名称。

![image-20250825193337285](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825193337285.png)

13、最终效果如图：

![image-20250825193837908](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825193837908.png)

## 三、程序运行结果

列出程序的最终运行结果及截图。

1、使用快速启动模板创建的小程序：需要分别获取用户姓名和头像

![image-20250825173444220](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825173444220.png)

![image-20250825173506278](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825173506278.png)

2、不使用模板手动创建的小程序：同时获取头像和姓名（需在老版本中进行，最新版本不适用！这里使用2.25.4版本）

![image-20250825194121575](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825194121575.png)

代码文件结构如图所示：

![image-20250825193504837](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250825193504837.png)



## 四、问题总结与体会

描述实验过程中所遇到的问题，以及是如何解决的。有哪些收获和体会，对于课程的安排有哪些建议。



**问题1：**对于每个文件的后缀名不太能清晰分辨，文件结构比较复杂，分级明显。

**解决：**拉表记录每一后缀名代表的意义，对比分析进行记忆。

**问题2：**课程上提出的获取信息的函数不适用，无法获取用户信息。

**解决：**在开发平台上可以通过模拟老版本进行复现，但通过手机扫码无法实现（因为手机是新版本）。



**收获和体会：**本次实验让我初步了解了一个网站的搭建体系框架，对于全局作用和个体作用有了更加深入的了解和认识；同时每一种文件代表着不同的作用，他们彼此之间变量信息的传递让我对代码的运行逻辑有了更加透彻的理解；同时，通过动手体验这些前端的知识，我对与这次的小程序开发之旅更加期待。