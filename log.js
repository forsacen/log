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
    this.stackDeep=3
}
loger.prototype.print=function(arg){
    console.log(arg)
}
loger.prototype.setStackDeep=function(stackDeep){
    this.stackDeep=stackDeep
}
/****************************
 * sql日志
 * @param db
 */
function newSqlLoger(db){
    return newSqlLoger(db)
}

let sqlLoger=function(db){
    this.db=db
}
sqlLoger.prototype.warn=function(arg,cb){

}
sqlLoger.prototype.fatal=function(arg,cb){

}
sqlLoger.prototype.debug=function(arg,cb){

}

/****************************
 * mongodb日志
 * @param db
 */

function newMongoLoger(db){
    return new mongoLoger(db)
}

let mongoLoger=function(db){
    this.db=db
    this.stackDeep=3
}

mongoLoger.prototype.warn=function(arg,cb){
    this._save(arg,'warning',cb)
}

mongoLoger.prototype.fatal=function(arg,cb){
    this._save(arg,'fatal',cb)
}

mongoLoger.prototype.debug=function(arg,cb){
    this._save(arg,'debug',cb)
}

mongoLoger.prototype._save=function(arg,flag,cb){
    let stack=_getStackArray()
    let projectname=_getProjectName()
    let data={
        host:os.hostname(),
        ip:_getIp(),
        project:projectname,
        time:new Date().toLocaleString(),
        label:flag,
        msg:arg instanceof Error?arg.message:arg,
        file:stack[this.stackDeep].getFileName(),
        line:stack[this.stackDeep].getLineNumber(),
        entry:_getEntryFile(),
        stack:arg instanceof Error?arg.stack:null,
    }
    this.db.collection(projectname).insertOne(data,function(err){
        if(cb&&typeof cb=='function'){
            cb(err,data)
        }
    })
}

/****************************
 * 本地日志,非线程安全
 * @param db
 */
function newLocalLoger(file){
    return new localLoger(file)
}

let localLoger=function(file){
    this.file=file
    this.stackDeep=3
}

localLoger.prototype.warn=function(arg,cb){
    this._save(arg,'warning',cb)
}

localLoger.prototype.fatal=function (arg,cb) {
    this._save(arg,'fatal',cb)
}

localLoger.prototype.debug=function (arg,cb) {
    this._save(arg,'debug',cb)
}

localLoger.prototype.print=function(arg){
    console.log(arg instanceof Error?arg.stack:arg)
}

localLoger.prototype._save=function(arg,flag,cb){
    let stack=_getStackArray()
    let data={
        label:flag,
        time:new Date().toLocaleString(),
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
 * @param {object} [option.file=null] 本地日志文件名
 *
 *用法loger=newSmartLoger({db:xxx,file:project.log});loger.warn(e,function(rate,data){})
 */
function newSmartLoger(option){
    return new smartLoger(option)
}
let smartLoger=function(option){
    this.dbLoger=null
    this.localLoger=null
    if(option.db){
        this.dbLoger=newMongoLoger(option.db)
        this.dbLoger.setStackDeep(4)
    }
    if(option.file){
        this.localLoger=newLocalLoger(option.file)
        this.localLoger.setStackDeep(4)
    }
}

smartLoger.prototype.warn=function(arg,cb){
    let eRate=0
    let dbLoger=this.dbLoger
    let localLoger=this.localLoger
    if(dbLoger){
        dbLoger.warn(arg,function(err,data){
            if(err){
                eRate=eRate+1
                dbLoger.print(err)
                if(localLoger){
                    localLoger._write(data,function(e,data){
                        if(e){
                            eRate+=2
                            localLoger.print(e)
                            if(cb&&typeof cb=='function'){
                                cb(new Error('smartLog write failed,loger type:all,error rate:3'),data)
                            }
                        }else{
                            cb(null)
                        }
                    })
                }else{
                    if(cb&&typeof cb=='function'){
                        cb(new Error('smartLog write failed,loger type:dbLoger,error rate:1'),data)
                    }
                }
            }else{
                cb(null)
            }
        })
    }else if(localLoger){
        localLoger.warn(arg,function(e,data){
            if(e){
                eRate+=2
                localLoger.print(e)
                if(cb&&typeof cb=='function'){
                    cb(new Error('smartLog write failed,loger type:local,error rate:2'),data)
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null)
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

smartLoger.prototype.fatal=function(arg,cb){
    let eRate=0
    let dbLoger=this.dbLoger
    let localLoger=this.localLoger
    if(dbLoger){
        dbLoger.fatal(arg,function(err,data){
            if(err){
                eRate=eRate+1
                dbLoger.print(err)
                if(localLoger){
                    localLoger._write(data,function(e,data){
                        if(e){
                            eRate+=2
                            localLoger.print(e)
                            if(cb&&typeof cb=='function'){
                                cb(new Error('smartLog write failed,loger type:all,error rate:3'),data)
                            }
                        }else{
                            cb(null)
                        }
                    })
                }else{
                    if(cb&&typeof cb=='function'){
                        cb(new Error('smartLog write failed,loger type:db,error rate:1'),data)
                    }
                }
            }else{
                cb(null)
            }
        })
    }else if(localLoger){
        localLoger.fatal(arg,function(e,data){
            if(e){
                eRate+=2
                localLoger.print(e)
                if(cb&&typeof cb=='function'){
                    cb(new Error('smartLog write failed,loger type:local,error rate:2'),data)
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null)
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

smartLoger.prototype.debug=function(arg,cb){
    let eRate=0
    let dbLoger=this.dbLoger
    let localLoger=this.localLoger
    if(dbLoger){
        dbLoger.debug(arg,function(err,data){
            if(err){
                eRate=eRate+1
                dbLoger.print(err)
                if(localLoger){
                    localLoger._write(data,function(e,data){
                        if(e){
                            eRate+=2
                            localLoger.print(e)
                            if(cb&&typeof cb=='function'){
                                cb(new Error('smartLog write failed,loger type:all,error rate:3'),data)
                            }
                        }else{
                            cb(null)
                        }
                    })
                }else{
                    if(cb&&typeof cb=='function'){
                        cb(new Error('smartLog write failed,loger type:db,error rate:1'),data)
                    }
                }
            }else{
                cb(null)
            }
        })
    }else if(localLoger){
        localLoger.debug(arg,function(e,data){
            if(e){
                eRate+=2
                localLoger.print(e)
                if(cb&&typeof cb=='function'){
                    cb(new Error('smartLog write failed,loger type:local,error rate:2'),data)
                }
            }else{
                if(cb&&typeof cb=='function'){
                    cb(null)
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
/*****************************/
util.inherits(sqlLoger,loger)
util.inherits(mongoLoger,loger)
util.inherits(localLoger,loger)
util.inherits(smartLoger,loger)
module.exports={
    newSqlLoger:newSqlLoger,
    newMongoLoger:newMongoLoger,
    newLocalLoger:newLocalLoger,
    newSmartLoger:newSmartLoger,
}