const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('zeiDesktop', {
    isElectron: true
});
