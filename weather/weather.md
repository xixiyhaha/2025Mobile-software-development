# 2025年夏季《移动软件开发》实验报告



<center>姓名：邓林  学号：23020007014</center>

| 姓名和学号           | 邓林，23020007014                                            |
| -------------------- | ------------------------------------------------------------ |
| 本实验属于哪门课程？ | 中国海洋大学25夏《移动软件开发》                             |
| 实验名称？           | 实验2：天气查询小程序                                        |
| 博客地址？           | [写文章-CSDN创作中心](https://mp.csdn.net/mp_blog/creation/editor/150867025) |
| Github仓库地址？     | https://github.com/xixiyhaha/2025Mobile-software-development.git |

（备注：将实验报告发布在博客、代码公开至 github 是 **加分项**，不是必须做的）



## **一、实验目标**

1、掌握服务器域名 配置和临时服务器部署；

2、掌握 wx.request 接口的用法。



## 二、实验步骤

列出实验的关键步骤、代码解析、截图。

1、新建小程序，命名为weather；

2、清空文件并新建框架；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826093703782.png" alt="image-20250826093703782" style="zoom:50%;" />



3、设置容器样式；

4、基本设计界面元素、排版，结果如图；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826093816693.png" alt="image-20250826093816693" style="zoom: 33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826093843889.png" alt="image-20250826093843889" style="zoom:25%;" />

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826162308845.png" alt="image-20250826162308845" style="zoom:33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826162352128.png" alt="image-20250826162352128" style="zoom:33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826093920817.png" alt="image-20250826093920817" style="zoom: 25%;" /> 

  



5、为地区设置picker地区选择器，并定义changeRegion函数，这里包括更新显示的地域名称、天气详细信息，增加getlocationID；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826142932923.png" alt="image-20250826142932923" style="zoom: 33%;" />

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826094115980.png" alt="image-20250826094115980" style="zoom: 33%;" />









6、注册和风平台账号，新建天气项目，获取API接口来获取天气数据；

![image-20250826095911071](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826095911071.png)

7、下载和风天气提供的天气图标并存入文件images中，将默认天气图标设为未知图标；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826100026390.png" alt="image-20250826100026390" style="zoom:50%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826100347958.png" alt="image-20250826100347958" style="zoom:50%;" />

8、记录下自己的api host和aip ket,将他们替换到以下链接中：https://your_api_host/v7/weather/now?location=101010100&key=your_api_key；在浏览器中访问链接应该可以直接获取到地区天气信息；这个链接可以获取地区LocationID：https://your_api_host/geo/v2/city/lookup?location=beij&key=your_api_key；

![image-20250826105939625](C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826105939625.png)



9、在微信公众平台修改服务器域名为https://your_api_host；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826110053867.png" alt="image-20250826110053867" style="zoom:50%;" />

10、定义天气信息获取函数getWeather、getlocationID；

getWeather：用`getlocationID`获取到的 “地理位置 ID”，调用天气 API 的 “实时天气接口”，获取该地区的实时天气数据，并把数据存入页面，

getlocationID：通过用户选择的地区名称，调用天气 API 的 “城市搜索接口”，获取该地区对应的唯一地理位置 ID。

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826115314732.png" alt="image-20250826115314732" style="zoom:50%;" />

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826143320433.png" alt="image-20250826143320433" style="zoom:50%;" />

11、查看now数组中各元素，并修改对应的变量；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826154958084.png" alt="image-20250826154958084" style="zoom: 33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826155110954.png" alt="image-20250826155110954" style="zoom: 33%;" />

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826154937320.png" alt="image-20250826154937320" style="zoom:50%;" />

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826155020750.png" alt="image-20250826155020750" style="zoom:50%;" />

12、到这里最基本的选择地区更新地区天气的基本小程序就完成了。

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826155529204.png" alt="image-20250826155529204" style="zoom:50%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826155702238.png" alt="image-20250826155702238" style="zoom:50%;" />

13、这里我们也可以对小程序进行一些升级：当我们编译代码后会发现界面现实的是我们预设的“未知”天气，只有在我们重新选择地区后才会更新，我们可以添加onLoad函数使代码在编译使就进行数据更新；

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826160053651.png" alt="image-20250826160053651" style="zoom: 50%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826160121411.png" alt="image-20250826160121411" style="zoom: 33%;" />



14、我们也可以对页面进行一些美化。

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826164758389.png" alt="image-20250826164758389" style="zoom:33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826164828450.png" alt="image-20250826164828450" style="zoom: 25%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826164847525.png" alt="image-20250826164847525" style="zoom:33%;" />











## 三、程序运行结果

列出程序的最终运行结果及截图。

<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826164908443.png" alt="image-20250826164908443" style="zoom: 33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826164935919.png" alt="image-20250826164935919" style="zoom: 33%;" /> <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826165019437.png" alt="image-20250826165019437" style="zoom: 33%;" />



## 四、问题总结与体会

描述实验过程中所遇到的问题，以及是如何解决的。有哪些收获和体会，对于课程的安排有哪些建议。

**问题：**在和风天气获取API访问天气数据时，由于老版本的访问请求url和现在不一样，导致访问失败。

**解决：**新版的访问链接 <img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826165652160.png" alt="image-20250826165652160" style="zoom: 50%;" /> 也并不完整，而是应该在后面加上key=’your_api_key'，故完整的请求示例为：https://your_api_host/v7/weather/now?location=101010100&key=your_api_key；同时要将老版中的地名换为LocationID，故还需要访问：https://your_api_host/geo/v2/city/lookup?location=beij&key=your_api_key；<img src="C:\Users\18501\AppData\Roaming\Typora\typora-user-images\image-20250826165534722.png" alt="image-20250826165534722" style="zoom:50%;" />



**收获和体会：**通过这次小程序的制作，我掌握了通过wx.request接口访问外界链接的方法，也掌握了修改服务器域名的方法。通过wx.request接口，极大地丰富了小程序的玩法和功能，相当于给我们的小程序连上了网，能够进行更多使用地操作。同时，对天气界面的设计，我对flex排版的使用更加熟练。