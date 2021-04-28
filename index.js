const path=require('path')
const fs=require('fs')
const os=require('os')
const util=require('util')
function _getStackArray(){
    let oldPrepareStackTrace = Error.prepareStackTrace
    Error.prepareStackTrace = function (error, stack){
        return stack
    }
    let stack=new Error().stack
    Error.prepareStackTrace=oldPrepareStackTrace
    return stack
}

function _getEntryFile(){
    let entry=module
    while(entry.parent){
        entry=entry.parent
    }
    return entry.filename
}

function _getProjectName(){
    let entry=module
    while(entry.parent){
        entry=entry.parent
    }
    return path.basename(entry.path)
}

function _getIp() {
    let interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        let iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}
/****************************
 * base日志
 * @param db
 */
let loger=function(){
    this.sd=4
    this.stackDeep=this.sd
}

loger.prototype.setStackDeep=function(stackDeep){
    this.stackDeep=stackDeep
}
loger.prototype.setSD=function(sd){
    this.sd=sd
}
/****************************
 * sql日志
 * @param db
 */

let sqlLoger=function(db){
    this.db=db
}
sqlLoger.prototype.warn=function(arg,cb){

}
sqlLoger.prototype.fatal=function(arg,cb){

}
sqlLoger.prototype.log=function(arg,cb){

}

/****************************
 * mongodb日志
 * @param db
 */


let mongoLoger=function(db,col){
    this.db=db
    this.col=col
    this.sd=4
    this.stackDeep=this.sd
}

mongoLoger.prototype._warn=function(arg,cb){
    this._save(arg,'warning',cb)
}

mongoLoger.prototype._fatal=function(arg,cb){
    this._save(arg,'fatal',cb)
}

mongoLoger.prototype._log=function(arg,cb){
    this._save(arg,'log',cb)
}

mongoLoger.prototype.warn=function(arg,cb){
    if(cb&&typeof cb=='function'){
        this.setStackDeep(this.sd)
        return this._warn(arg,cb)
    }else{
        this.setStackDeep(this.sd+2)
        return new Promise((resolve, reject)=> {
            this._warn(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

mongoLoger.prototype.fatal=function(arg,cb){
    if(cb&&typeof cb=='function'){
        this.setStackDeep(this.sd)
        return this._fatal(arg,cb)
    }else{
        this.setStackDeep(this.sd+2)
        return new Promise((resolve, reject)=> {
            this._fatal(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

mongoLoger.prototype.log=function(arg,cb){
    if(cb&&typeof cb=='function'){
        this.setStackDeep(this.sd)
        return this._log(arg,cb)
    }else{
        this.setStackDeep(this.sd+2)
        return new Promise((resolve, reject)=> {
            this._log(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

mongoLoger.prototype._save=function(arg,flag,cb){
    let stack=_getStackArray()
    let projectname=_getProjectName()
    let col=this.col?this.col:projectname
    let data={
        host:os.hostname(),
        ip:_getIp(),
        project:projectname,
        time:new Date().toISOString(),
        label:flag,
        msg:arg instanceof Error?arg.message:arg,
        file:stack[this.stackDeep].getFileName(),
        line:stack[this.stackDeep].getLineNumber(),
        entry:_getEntryFile(),
        stack:arg instanceof Error?arg.stack:null,
    }
    this.db.collection(col).insertOne(data,function(err){
        if(cb&&typeof cb=='function'){
            cb(err,data)
        }
    })
}

/****************************
 * 本地日志,非线程安全
 * @param db
 */

let localLoger=function(file){
    this.file=file
    this.sd=4
    this.stackDeep=this.sd
}

localLoger.prototype._warn=function(arg,cb){
    this._save(arg,'warning',cb)
}

localLoger.prototype._fatal=function (arg,cb) {
    this._save(arg,'fatal',cb)
}

localLoger.prototype._log=function (arg,cb) {
    this._save(arg,'log',cb)
}

localLoger.prototype.warn=function(arg,cb){
    if(cb&&typeof cb=='function'){
        this.setStackDeep(this.sd)
        return this._warn(arg,cb)
    }else{
        this.setStackDeep(this.sd+2)
        return new Promise((resolve, reject)=> {
            this._warn(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

localLoger.prototype.fatal=function(arg,cb){
    if(cb&&typeof cb=='function'){
        this.setStackDeep(this.sd)
        return this._fatal(arg,cb)
    }else{
        this.setStackDeep(this.sd+2)
        return new Promise((resolve, reject)=> {
            this._fatal(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

localLoger.prototype.log=function(arg,cb){
    if(cb&&typeof cb=='function'){
        this.setStackDeep(this.sd)
        return this._log(arg,cb)
    }else{
        this.setStackDeep(this.sd+2)
        return new Promise((resolve, reject)=> {
            this._log(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

localLoger.prototype._save=function(arg,flag,cb){
    let stack=_getStackArray()
    let data={
        label:flag,
        time:new Date().toISOString(),
        msg:arg instanceof Error?arg.message:arg,
        file:stack[this.stackDeep].getFileName(),
        line:stack[this.stackDeep].getLineNumber(),
        entry:_getEntryFile(),
        stack:arg instanceof Error?arg.stack:null,
    }
    let s=JSON.stringify(data,null,2)
    fs.appendFile(this.file,s+'\n',function(err){
        if(cb&&typeof cb=='function'){
            cb(err,data)
        }
    })
}
localLoger.prototype._write=function(data,cb){
    let s=JSON.stringify(data,null,2)
    fs.appendFile(this.file,s+'\n',function(err){
        if(cb&&typeof cb=='function'){
            cb(err,data)
        }
    })
}
/****************************
 * 智能日志,若数据库日志失败则写为本地日志，本地日非线程安全
 * 先尝试使用mongoLoger,如果写入失败则转为使用localLoger
 *
 * @param {object} option 参数
 * @param {object} [option.db=null] mongodb数据库
 * @param {object} [option.col=null] mongodb集合名
 * @param {object} [option.file=null] 本地日志文件名
 *
 *用法loger=newSmartLoger({db:xxx,file:project.log});loger.warn(e,function(rate,data){})
 */
let smartLoger=function(option){
    this.dbLoger=null
    this.localLoger=null
    if(option.db){
        if(option.col){
            this.dbLoger=new mongoLoger(option.db,option.col)
        }else{
            this.dbLoger=new mongoLoger(option.db)
        }
        this.dbStackDeep=6
    }
    if(option.file){
        this.localLoger=new localLoger(option.file)
        this.localStackDeep=6
    }
}

smartLoger.prototype._warn=function(arg,cb){
    let eRate=0
    let dbLoger=this.dbLoger
    let localLoger=this.localLoger
    if(dbLoger){
        dbLoger.warn(arg,function(err,data){
            if(err){
                eRate=eRate+1
                if(localLoger){
                    localLoger._write(data,function(e,data){
                        if(e){
                            eRate+=2
                            if(cb&&typeof cb=='function'){
                                cb(new Error('smartLog write failed,loger type:all,error rate:3'),data)
                            }
                        }else{
                            if(cb&&typeof cb=='function') {
                                cb(null,data)
                            }
                        }
                    })
                }else{
                    if(cb&&typeof cb=='function'){
                        cb(new Error('smartLog write failed,loger type:dbLoger,error rate:1'),data)
                    }
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null,data)
                }
            }
        })
    }else if(localLoger){
        localLoger.warn(arg,function(e,data){
            if(e){
                eRate+=2
                if(cb&&typeof cb=='function'){
                    cb(new Error('smartLog write failed,loger type:local,error rate:2'),data)
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null,data)
                }
            }
        })
    }else{
        eRate+=3
        if(cb&&typeof cb=='function'){
            cb(new Error('smartLog write failed,both dbLoger and localLorger are null,error rate:3'))
        }
    }
}

smartLoger.prototype._fatal=function(arg,cb){
    let eRate=0
    let dbLoger=this.dbLoger
    let localLoger=this.localLoger
    if(dbLoger){
        dbLoger.fatal(arg,function(err,data){
            if(err){
                eRate=eRate+1
                if(localLoger){
                    localLoger._write(data,function(e,data){
                        if(e){
                            eRate+=2
                            if(cb&&typeof cb=='function'){
                                cb(new Error('smartLog write failed,loger type:all,error rate:3'),data)
                            }
                        }else{
                            if(cb&&typeof cb=='function') {
                                cb(null,data)
                            }
                        }
                    })
                }else{
                    if(cb&&typeof cb=='function'){
                        cb(new Error('smartLog write failed,loger type:db,error rate:1'),data)
                    }
                }
            }else{
                if(cb&&typeof cb=='function') {
                    cb(null,data)
                }
            }
        })
    }else if(localLoger){
        localLoger.fatal(arg,function(e,data){
            if(e){
                eRate+=2
                if(cb&&typeof cb=='function'){
                    cb(new Error('smartLog write failed,loger type:local,error rate:2'),data)
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null,data)
                }
            }
        })
    }else{
        eRate+=3
        if(cb&&typeof cb=='function'){
            cb(new Error('smartLog write failed,both dbLoger and localLorger are null'))
        }
    }
}

smartLoger.prototype._log=function(arg,cb){
    let eRate=0
    let dbLoger=this.dbLoger
    let localLoger=this.localLoger
    if(dbLoger){
        dbLoger.log(arg,function(err,data){
            if(err){
                eRate=eRate+1
                if(localLoger){
                    localLoger._write(data,function(e,data){
                        if(e){
                            eRate+=2
                            if(cb&&typeof cb=='function'){
                                cb(new Error('smartLog write failed,loger type:all,error rate:3'),data)
                            }
                        }else{
                            if(cb&&typeof cb=='function') {
                                cb(null,data)
                            }
                        }
                    })
                }else{
                    if(cb&&typeof cb=='function'){
                        cb(new Error('smartLog write failed,loger type:db,error rate:1'),data)
                    }
                }
            }else{
                if(cb&&typeof cb=='function') {
                    cb(null,data)
                }
            }
        })
    }else if(localLoger){
        localLoger.log(arg,function(e,data){
            if(e){
                eRate+=2
                if(cb&&typeof cb=='function'){
                    cb(new Error('smartLog write failed,loger type:local,error rate:2'),data)
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null,data)
                }
            }
        })
    }else{
        eRate+=3
        if(cb&&typeof cb=='function'){
            cb(new Error('smartLog write failed,both dbLoger and localLorger are null'))
        }
    }
}

smartLoger.prototype.warn=function(arg,cb){
    if(cb&&typeof cb=='function'){
        if(this.localLoger){
            this.localLoger.setSD(this.localStackDeep)
        }
        if(this.dbLoger){
            this.dbLoger.setSD(this.dbStackDeep)
        }
        return this._warn(arg,cb)
    }else{
        if(this.localLoger){
            this.localLoger.setSD(this.localStackDeep+2)
        }
        if(this.dbLoger){
            this.dbLoger.setSD(this.dbStackDeep+2)
        }
        return new Promise((resolve, reject)=> {
            this._warn(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

smartLoger.prototype.fatal=function(arg,cb){
    if(cb&&typeof cb=='function'){
        if(this.localLoger){
            this.localLoger.setSD(this.localStackDeep)
        }
        if(this.dbLoger){
            this.dbLoger.setSD(this.dbStackDeep)
        }
        return this._fatal(arg,cb)
    }else{
        if(this.localLoger){
            this.localLoger.setSD(this.localStackDeep+2)
        }
        if(this.dbLoger){
            this.dbLoger.setSD(this.dbStackDeep+2)
        }
        return new Promise((resolve, reject)=> {
            this._fatal(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}

smartLoger.prototype.log=function(arg,cb){
    if(cb&&typeof cb=='function'){
        if(this.localLoger){
            this.localLoger.setSD(this.localStackDeep)
        }
        if(this.dbLoger){
            this.dbLoger.setSD(this.dbStackDeep)
        }
        return this._log(arg,cb)
    }else{
        if(this.localLoger){
            this.localLoger.setSD(this.localStackDeep+2)
        }
        if(this.dbLoger){
            this.dbLoger.setSD(this.dbStackDeep+2)
        }
        return new Promise((resolve, reject)=> {
            this._log(arg,function (err,data) {
                if(err){
                    reject(err)
                }else{
                    resolve(data)
                }
            })
        })
    }
}
/*****************************/
util.inherits(sqlLoger,loger)
util.inherits(mongoLoger,loger)
util.inherits(localLoger,loger)
util.inherits(smartLoger,loger)
module.exports={
    mongoLoger:mongoLoger,
    sqlLoger:sqlLoger,
    localLoger:localLoger,
    smartLoger:smartLoger,
}