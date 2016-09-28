## 新增模块

新增behavior对象的异步接口，主要有两个：

* setBeforeCallbackHook(hook[,options])

hook 是一个抽象接口，为function对象，里面实现需要植入回调前的钩子方法，options有如下两个属性:

	timeout: Number
	promisified: Boolean defualt: false

timeout 为设定的延时值，设定在回调执行前的延时，promisified为是否将传递给回调传递proimse包装的异步信息，传递异步信息必须包装在promise中

* yieldsBeforeCallbackHook(context[,arg1[,arg2 ...]])

context为植入回调前的钩子函数的context，后面接受的附加参数为需要注入钩子函数的参数，context不能不设定，可以为undefined，这样this会指向sinon的behavior对象。

stub函数跟spy函数可以完全根据sinon的文档来使用,实际的使用可以参考[sinon文档][1]



[1]: http://sinonjs.org/docs/