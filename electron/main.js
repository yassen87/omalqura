const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { startServer, PORT } = require('../server');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1360,
        height: 900,
        minWidth: 960,
        minHeight: 680,
        backgroundColor: '#0b1120',
        title: 'زين للعطور — واتساب داش',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

const menu = Menu.buildFromTemplate([
    {
        label: 'ملف',
        submenu: [
            { role: 'reload', label: 'تحديث' },
            { role: 'toggleDevTools', label: 'أدوات المطور' },
            { type: 'separator' },
            { role: 'quit', label: 'إغلاق' }
        ]
    }
]);

app.whenReady().then(async () => {
    Menu.setApplicationMenu(menu);
    await startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
