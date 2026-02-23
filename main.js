const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    // Configuramos la ventana de la aplicación
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        // icon: path.join(__dirname, 'public/brand/logo.png'), // Descomenta esto luego para ponerle tu logo
        webPreferences: {
            nodeIntegration: true
        }
    });

    // Le decimos que cargue tu aplicación Next.js local
    win.loadURL('http://localhost:3000');

    // Ocultamos el menú feo de arriba (Archivo, Editar, Ver) para que se vea como app real
    win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
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