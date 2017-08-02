fork = require('child_process').fork
moment = require('moment')
_ = require('lodash')

class MasterWatcher {

    constructor(task, deps) {
        const defaults = {
            timeout: 15000,
            period: 15000,
            observerTimeout: 5000,
            shouldFinish: false,
            taskIsRunning: false,
            debug: false,
            fork,
            moment
        }
        _.extend(this, _.defaults(task, deps, defaults))
        if (!this.executor) throw new Error('Undefined executor')
    }

    start() {
        this.currentTask = this.fork(this.executor, [this.args], {env: this.env});
        this.startObserver();
        const _this = this
        this.currentTask.on('exit', (code, msg) => {
            _this.log("Hey, exited! " + code + " " + msg)
            _this.log("waiting to restart...")

            this.taskIsRunning = false
            clearInterval(_this.watcher)
            setTimeout( () => {
                if (_this.shouldFinish) {
                    _this.shutdownFn()
                } else {
                    _this.taskIsRunning = true;
                    return _this.start()
                }
            }, _this.period)
        })
        this.currentTask.on('error', (error) => {
            _this.log(error);
        })
        return this.currentTask.on('message', data => {
            _this.log("received message " + data)
            if (data === 'alive') {
                _this.lastVerification = _this.moment()
            }
            if (data === 'finish') {
                _this._stop()
            }
        })
    }

    startObserver() {
        this.log('Starting observer')
        this.lastVerification = this.moment();
        const _this = this
        this.watcher = setInterval( () => {
            if (_this.moment().diff(_this.lastVerification, 'milliseconds') > _this.timeout) {
                console.error('Timeout!')
                return _this._stop()
            } else {
                // return log('its ok');
            }
        }, this.observerTimeout)
    }

    _stop() {
        this.log('Forcing exit')
        this.currentTask.kill()
        clearInterval(this.watcher)
    }

    shutdown() {
        console.log('Shutting down', this.name)
        this.shouldFinish = true
        if (!this.taskIsRunning) this.shutdownFn()
    }

    log(msg) {
        if (this.debug) console.log(msg)
    }

}

module.exports = MasterWatcher;
