"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompilerService = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core")); // Use puppeteer-core
class CompilerService {
    constructor(context) {
        this.context = context;
    }
    /**
     * Finds the path to the bundled Chromium executable in a platform-agnostic way.
     * This relies on the browser being installed via the `@puppeteer/browsers` package
     * during the extension's pre-publish script.
     * @returns The path to the executable.
     * @throws An error if the executable cannot be found.
     */
    getChromiumExecutablePath() {
        // The root path where the browser is installed, inside the extension's directory.
        const browsersPath = path.join(this.context.extensionPath, 'node_modules', '@puppeteer', 'browsers');
        if (!fs.existsSync(browsersPath)) {
            throw new Error(`Chromium download directory not found at "${browsersPath}". Please run the install script.`);
        }
        // 1. Find the chrome browser directory (e.g., "chrome-win64-125.0.6422.60")
        const browserDirName = fs.readdirSync(browsersPath).find(item => {
            const itemPath = path.join(browsersPath, item);
            return item.startsWith('chrome') && fs.statSync(itemPath).isDirectory();
        });
        if (!browserDirName) {
            throw new Error(`Could not find a downloaded Chrome browser directory in "${browsersPath}".`);
        }
        const browserDir = path.join(browsersPath, browserDirName);
        // 2. Determine the platform-specific executable path
        let executablePath;
        if (process.platform === 'win32') {
            // e.g., "chrome-win64-125.0.6422.60\chrome-win64\chrome.exe"
            const platformDir = fs.readdirSync(browserDir).find(d => d.startsWith('chrome-win'));
            if (!platformDir)
                throw new Error('Could not find windows platform directory.');
            executablePath = path.join(browserDir, platformDir, 'chrome.exe');
        }
        else if (process.platform === 'darwin') { // macOS
            // e.g., "chrome-mac-arm64-125.0.6422.60/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium"
            const platformDir = fs.readdirSync(browserDir).find(d => d.startsWith('chrome-mac'));
            if (!platformDir)
                throw new Error('Could not find macOS platform directory.');
            executablePath = path.join(browserDir, platformDir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
        }
        else { // linux
            // e.g., "chrome-linux-125.0.6422.60/chrome-linux/chrome"
            const platformDir = fs.readdirSync(browserDir).find(d => d.startsWith('chrome-linux'));
            if (!platformDir)
                throw new Error('Could not find linux platform directory.');
            executablePath = path.join(browserDir, platformDir, 'chrome');
        }
        if (!fs.existsSync(executablePath)) {
            throw new Error(`Chromium executable not found at expected path: ${executablePath}. The extension may not have been built correctly.`);
        }
        return executablePath;
    }
    async compile(document) {
        let browser = null;
        try {
            // No changes needed for parsing logic
            // const parsed = this.parseDocument(document);
            // if (!parsed) {
            //     vscode.window.showErrorMessage('Failed to parse ICS document');
            //     return;
            // }
            // const html = this.generateHTML(parsed);
            // const css = this.generateCSS();
            // Dummy data for demonstration
            const html = `<html><head><title>Test</title></head><body><h1>Hello, World!</h1></body></html>`;
            const css = `body { font-family: sans-serif; color: #333; } h1 { color: steelblue; }`;
            const htmlWithCSS = html.replace('</head>', `<style>${css}</style></head>`);
            const outputFile = document.fileName.replace(/\.ics$/, '.pdf');
            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Get the path to our bundled browser
            const executablePath = this.getChromiumExecutablePath();
            // Launch Puppeteer using the bundled Chromium
            browser = await puppeteer_core_1.default.launch({
                executablePath,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ],
            });
            const page = await browser.newPage();
            await page.setContent(htmlWithCSS, { waitUntil: 'networkidle0' });
            await page.pdf({
                path: outputFile,
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
            });
            vscode.window.showInformationMessage(`ICS compiled successfully to ${outputFile}`);
            vscode.env.openExternal(vscode.Uri.file(outputFile));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Compilation failed:", error); // Log the full error for debugging
            vscode.window.showErrorMessage(`Compilation failed: ${errorMessage}`);
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}
exports.CompilerService = CompilerService;
// In your main extension.ts file, you would initialize this service
// and pass the context to it.
// export function activate(context: vscode.ExtensionContext) {
//     const compiler = new CompilerService(context);
//
//     let disposable = vscode.commands.registerCommand('ics.compile', () => {
//         if (vscode.window.activeTextEditor) {
//             compiler.compile(vscode.window.activeTextEditor.document);
//         }
//     });
//
//     context.subscriptions.push(disposable);
// }
//# sourceMappingURL=compilerHelper.js.map