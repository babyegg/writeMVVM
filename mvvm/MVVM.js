// 观察者（发布订阅）模式 观察者 被观察者
class Dep {
    constructor(){
        this.subs = [] // 存放所有的watcher
    }
    // 订阅
    addSub(watcher){ // 添加watcher
        this.subs.push(watcher)
    }
    // 发布
    notify(){
        this.subs.forEach(watcher=>watcher.update())
    }
}
class Watcher{
    constructor(vm,expr,cb){
        this.vm = vm
        this.expr = expr
        this.cb = cb
        // 默认先放一个老值
        this.oldValue = this.get()
    }
    get(){ // vm.$data.school vm.$data.shcoolo.name
        Dep.target = this; // 先把自己放在this上
        // 取值 把这个观察者和数据关联起来
        let value = CompileUtil.getVal(this.vm,this.expr)
        Dep.target = null // 不取消 任何值取值都会添加watcher
        return value
    }
    update(){// 更新操作 数据变化后 会调用观察者的update方法
        let newVal = CompileUtil.getVal(this.vm, this.expr)
        if(newVal !== this.oldValue) {
            this.cb(newVal)
        }
    }
}
// vm.$watch(vm, 'school.name', (newVal)=>{
    
// })
// 实现数据劫持功能
class Observer{
    constructor(data){
        this.observer(data)
    }
    observer(data){
        // 如果是对象才观察
        if(data && typeof data == 'object'){
            // 如果是对象
            for(let key in data){
                this.defineReactive(data, key, data[key])
            }
        }
    }
    defineReactive(obj,key,value){
        this.observer(value) // school:[watcher, watcher] b:[watcher]
        let dep = new Dep() // 给每一个属性都加上一个具有发布订阅的功能
        // 数据劫持
        Object.defineProperty(obj,key,{
            get(){
                // 创建watcher时 会取到对应的内容 并且把watcher放到了全局上
                Dep.target && dep.addSub(Dep.target)
                return value
            },
            set:(newVal)=>{ // {school:{name:'yui'}} school={}
                if(newVal!=value) {
                    this.observer(newVal)
                    value = newVal
                    dep.notify()
                }   
            }
        })
    }
}
// 基类 调度
class Compiler{
    constructor(el,vm){
        // 判断el属性是不是一个元素 如果不是元素 那就获取他
        this.el = this.isElementNode(el) ? el:document.querySelector(el);
        //把当前节点中的元素 获取到 放到内存中
        this.vm = vm
        let fragment = this.node2fragmaent(this.el)
        //把节点中的内容进行替换
        //编译模板 用数据编译
        this.compile(fragment)
        //把内容再塞到页面中
        this.el.appendChild(fragment)
    }
    isDirective(attrName) {
        return attrName.startsWith('v-')
    }
    // 编译元素的 找v-
    compileElement(node){
        let attributes = node.attributes; // 类数组
        [...attributes].forEach(attr=>{ // type="text" v-model="school.name"
            let {name,value:expr} = attr
            // 判断是不是指令
            if(this.isDirective(name)){ // v-model v-html v-bind 
                let [,directive] = name.split('-') // v-in:click
                let [directiveName, eventName] = directive.split(':')
                // 需要调用不同的指令来处理
                CompileUtil[directiveName](node,expr,this.vm,eventName)
            }
        })
    }
    // 编译文本的 找{{}}
    compileText(node){ // 判断当前文本节点中的内容是否包括{{}}
        let content = node.textContent
        if(/\{\{(.+?)\}\}/.test(content)){
            // 找到所有文本
            CompileUtil['text'](node,content,this.vm) // {{a}} {{b}} {{c}}

        }
    }
    // 用来编译内存中的dom节点
    compile(node){
        let childNodes = node.childNodes;
        [...childNodes].forEach(child=>{
            if(this.isElementNode(child)){
                this.compileElement(child)
                // 如果是元素的话 需要把自己传进去 再去遍历子节点
                this.compile(child)
            }else{
                this.compileText(child)
            }
        })
    }
    // 把节点移动到内存中
    node2fragmaent(node){
        // 创建一个文档碎片
        let fragment = document.createDocumentFragment()
        let firstChild
        while(firstChild = node.firstChild){
            // appendChild具有移动性
            fragment.appendChild(firstChild)
        }
        return fragment
    }
    isElementNode(node){
        // 是不是元素节点
        return node.nodeType === 1;
    }
}
CompileUtil = {
    // 根据表达式取到对应的数据
    getVal(vm, expr){ // vm.$data 'school.name' [school,name] 
        return expr.split('.').reduce((data,current)=>{
            return data[current];
        },vm.$data);
        
    },
    setVal(vm, expr, value){ // vm.$data school.name = 'egg'
        return expr.split('.').reduce((data,current,index,arr)=>{
            if(index == arr.length-1){
                return data[current] = value
            }
            return data[current];
        },vm.$data);
    },
    // 解析v-model这个指令
    model(node,expr,vm){// node是节点 expr是表达式 vm是当前实例 school.name vm.$data
        // 给输入框赋予value属性 node.value = xxx
        let fn = this.updater['modelUpdater']
        new Watcher(vm, expr, (newVal)=>{ // 给输入框加一个观察者 如果稍后数据更新了会触发此方法 会拿新值给输入框赋予值
            fn(node,newVal)
        })
        node.addEventListener('input', (e)=>{
            let value = e.target.value // 获取用户输入的内容
            this.setValue(vm, expr, value)
        })
        let value = this.getVal(vm,expr) // yui
        fn(node,value)
    },
    html(node, expr, vm){ // v-html="message"
        let fn = this.updater['htmlUpdater']
        new Watcher(vm, expr, (newVal)=>{ // 给输入框加一个观察者 如果稍后数据更新了会触发此方法 会拿新值给输入框赋予值
            fn(node,newVal)
        })
        let value = this.getVal(vm,expr) // message
        fn(node,value)
    },
    getContentValue(vm, expr){
        // 遍表达式 将内容 重新替换成一个完整的内容 返还回去
        return expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            return this.getVal(vm, args[1])
        })
    },
    on(node,expr,vm,eventName){ // v-on:click = 'change'
        node.addEventListener(eventName, (e)=>{
            vm[expr].call(vm,e) // this.change
        })
    },
    text(node, expr, vm){ // expr=> {{a}} {{b}} => a b
        let fn = this.updater['textUpdater']
        let content = expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            // 给表达式每个{{}}都加上观察者
            new Watcher(vm, args[1], ()=>{
                fn(node,this.getContentValue(vm, expr)) // 反回了一个全的字符串
            })
            return this.getVal(vm,args[1]);
        })
        fn(node, content)
    },
    updater:{
        // 把数据插入到节点中
        modelUpdater(node,value){
            node.value = value
        },
        htmlUpdater(node,value){ // xss攻击
            node.innerHTML = value
        },
        textUpdater(node,value){
            node.textContent = value
        }
    }
}
class Vue{
    constructor(options){
        // this.$el $data $options
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods
        // 这个根元素 存在 编译模板
        if(this.$el){
            // 把数据全部转化成用Object.defineProperty来定义
            new Observer(this.$data)
            
            // {{getNewName}} reduce vm.$data.getNewName
            for (let key in computed) { // 有依赖关系 数据
                Object.defineProperty(this.$data, key, {
                    get:()=>{
                        return computed[key].call(this)
                    }
                })
            }

            for (let key in methods) {
                Object.defineProperty(this, key, {
                    get(){
                        return methods[key]
                    }
                })
            }

            // 把数据获取操作 vm上的取值操作 都代理到 vm.$data
            this.proxyVm(this.$data)
            
            new Compiler(this.$el,this);
        }
    }
    // backbone set() get()
    proxyVm(data){
        for(let key in data){ // {school:{name,age}}
            Object.defineProperty(this, key, { // 实现可以通过vm取到对应的内容
                get(){
                    return data[key] //进行了转化操作
                },
                set(newVal){ // 设置代理方法
                    data[key] = newVal
                }
            })
        }
    }
}