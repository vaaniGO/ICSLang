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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICSCompiler = void 0;
const allowed_flags = "";
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
class ICSCompiler {
    constructor() {
        const config = vscode.workspace.getConfiguration('ics');
        let outputPath = config.get('outputPath', './output');
        // Resolve path relative to workspace
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (!path.isAbsolute(outputPath)) {
                this.outputPath = path.resolve(workspaceRoot, outputPath);
            }
            else {
                this.outputPath = outputPath;
            }
        }
        else {
            this.outputPath = path.resolve(process.cwd(), outputPath);
        }
    }
    getOutputPath(fileName) {
        const config = vscode.workspace.getConfiguration('ics');
        let outputPath = config.get('outputPath', './output');
        const documentDir = path.dirname(fileName);
        let resolvedOutputPath;
        if (path.isAbsolute(outputPath)) {
            resolvedOutputPath = outputPath;
        }
        else {
            resolvedOutputPath = path.resolve(documentDir, outputPath);
        }
        const baseName = path.basename(fileName, '.ics');
        return path.join(resolvedOutputPath, `${baseName}.html`);
    }
    async compile(document) {
        try {
            const parsed = this.parseDocument(document);
            if (!parsed) {
                vscode.window.showErrorMessage('Failed to parse ICS document');
                return;
            }
            const html = this.generateHTML(parsed);
            const css = this.generateCSS();
            // Combine HTML with inline CSS - completely in memory
            const htmlWithCSS = html.replace('</head>', `<style>${css}</style></head>`);
            // Generate PDF output path
            const outputFile = this.getOutputPath(document.fileName).replace(/\.html$/, '.pdf');
            const outputDir = path.dirname(outputFile);
            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            // Try multiple PDF generation methods with fallbacks
            await this.generatePDFWithFallbacks(htmlWithCSS, outputFile);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Compilation failed: ${errorMessage}`);
        }
    }
    async generatePDFWithFallbacks(html, outputFile) {
        // Method 1: Try Puppeteer (original method)
        try {
            await this.generatePDFWithPuppeteer(html, outputFile);
            vscode.window.showInformationMessage(`ICS compiled successfully to ${outputFile}`);
            const uri = vscode.Uri.file(outputFile);
            vscode.env.openExternal(uri);
            return;
        }
        catch (puppeteerError) {
            console.log('Puppeteer failed, trying alternative methods...');
        }
        // Method 2: Try html-pdf-node
        try {
            await this.generatePDFWithHtmlPdfNode(html, outputFile);
            vscode.window.showInformationMessage(`ICS compiled successfully to ${outputFile}`);
            const uri = vscode.Uri.file(outputFile);
            vscode.env.openExternal(uri);
            return;
        }
        catch (htmlPdfError) {
            console.log('html-pdf-node failed, trying browser fallback...');
        }
        // Method 3: Fallback to opening HTML in browser
        await this.openInBrowser(html);
    }
    // Original Puppeteer method
    async generatePDFWithPuppeteer(html, outputFile) {
        const puppeteer = require('puppeteer');
        let browser = null;
        try {
            // Launch Puppeteer with Chrome installation handling
            browser = await this.launchPuppeteerWithFallback();
            const page = await browser.newPage();
            // Set content directly from HTML string - no temporary files
            await page.setContent(html, {
                waitUntil: 'networkidle0'
            });
            // Generate PDF directly to final location
            await page.pdf({
                path: outputFile,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '20px',
                    left: '20px',
                    right: '20px'
                }
            });
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    // Alternative Method 1: html-pdf-node
    async generatePDFWithHtmlPdfNode(html, outputFile) {
        try {
            const htmlPdf = require('html-pdf-node');
            const options = {
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '20px',
                    left: '20px',
                    right: '20px'
                }
            };
            const file = { content: html };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            fs.writeFileSync(outputFile, pdfBuffer);
        }
        catch (error) {
            throw new Error(`html-pdf-node generation failed: ${error}`);
        }
    }
    // Alternative Method 2: Open in browser for manual PDF save
    async openInBrowser(html) {
        const tempPath = path.join(os.tmpdir(), `ics-temp-${Date.now()}.html`);
        fs.writeFileSync(tempPath, html);
        const uri = vscode.Uri.file(tempPath);
        await vscode.env.openExternal(uri);
        vscode.window.showInformationMessage('PDF generation failed. HTML opened in browser. Use Ctrl+P (Cmd+P on Mac) to print to PDF.', 'OK');
        // Clean up temp file after a delay
        setTimeout(() => {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            }
            catch (error) {
                console.log('Could not clean up temp file:', error);
            }
        }, 30000); // 30 seconds delay
    }
    // Helper method to launch Puppeteer with fallback Chrome installation
    async launchPuppeteerWithFallback() {
        const puppeteer = require('puppeteer');
        try {
            // First attempt - try to launch with default settings
            return await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-extensions',
                    '--disable-plugins'
                ]
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Could not find Chrome')) {
                // Show progress and attempt to install Chrome
                const installed = await this.installChromeWithProgress();
                if (installed) {
                    // Try launching again after installation
                    return await puppeteer.launch({
                        headless: true,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-extensions',
                            '--disable-plugins'
                        ]
                    });
                }
            }
            // Re-throw the original error if we can't handle it
            throw error;
        }
    }
    // Helper method to install Chrome with progress indication
    async installChromeWithProgress() {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Installing Chrome for PDF generation",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: "Downloading Chrome..." });
                // Run the installation command
                (0, child_process_1.execSync)('npx puppeteer browsers install chrome', {
                    stdio: 'pipe',
                    timeout: 300000 // 5 minute timeout
                });
                progress.report({ increment: 100, message: "Chrome installed successfully!" });
                vscode.window.showInformationMessage('Chrome installed successfully! You can now compile ICS files to PDF.');
                return true;
            }
            catch (installError) {
                const installErrorMessage = installError instanceof Error ? installError.message : String(installError);
                vscode.window.showErrorMessage(`Failed to install Chrome automatically: ${installErrorMessage}. ` +
                    'Please run "npx puppeteer browsers install chrome" in your terminal.');
                return false;
            }
        });
    }
    // Optional: Add a command to manually install Chrome
    async installChrome() {
        await this.installChromeWithProgress();
    }
    // Optional: Method to check if Chrome is available
    async isChromeAvailable() {
        try {
            const puppeteer = require('puppeteer');
            const browser = await puppeteer.launch({ headless: true });
            await browser.close();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    // Optional: Add a health check command
    async checkChromeStatus() {
        const available = await this.isChromeAvailable();
        if (available) {
            vscode.window.showInformationMessage('Chrome is properly installed and ready for PDF generation.');
        }
        else {
            const action = await vscode.window.showWarningMessage('Chrome is not available for PDF generation.', 'Install Chrome');
            if (action === 'Install Chrome') {
                await this.installChromeWithProgress();
            }
        }
    }
    parseDocument(document) {
        const content = document.getText();
        const lines = content.split('\n');
        const doc = {
            assignmentName: '',
            studentName: '',
            date: '',
            collaborators: '',
            verified: '',
            problems: []
        };
        let currentProblem = null;
        let currentSection = null;
        let currentContent = [];
        let inHeader = false;
        let sectionStack = [];
        // Helper function to completely reset problem state
        const resetProblemState = () => {
            currentSection = null;
            currentContent = [];
            sectionStack = [];
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Check for header section start
            if (line === '<<header') {
                inHeader = true;
                continue;
            }
            // Check for header section end
            if (line === 'header>>' && inHeader) {
                inHeader = false;
                continue;
            }
            // Parse header information only when inside header tags
            if (inHeader) {
                if (line.startsWith('assignment:')) {
                    doc.assignmentName = line.substring(11).trim();
                }
                else if (line.startsWith('student:')) {
                    doc.studentName = line.substring(8).trim();
                }
                else if (line.startsWith('date:')) {
                    doc.date = line.substring(5).trim();
                }
                else if (line.startsWith('collaborators:')) {
                    doc.collaborators = line.substring(14).trim();
                }
                else if (line.startsWith('verified:')) {
                    doc.verified = line.substring(9).trim();
                }
                continue;
            }
            // Skip processing if we're still in header
            if (inHeader) {
                continue;
            }
            // Check for problem start
            const problemStartMatch = line.match(/^<<problem\s+(.+)$/);
            if (problemStartMatch) {
                // End previous problem if exists
                if (currentProblem) {
                    // End current section if exists
                    if (currentSection && sectionStack.length > 0) {
                        this.processSectionContent(currentSection, currentContent.join('\n'));
                        currentProblem.sections.push(currentSection);
                    }
                    doc.problems.push(currentProblem);
                }
                // Start new problem with complete state reset
                currentProblem = {
                    title: problemStartMatch[1].trim(),
                    sections: []
                };
                resetProblemState(); // Complete reset of all section-related state
                continue;
            }
            // Check for problem end
            if (line === 'problem>>' && currentProblem) {
                // End current section if exists
                if (currentSection && sectionStack.length > 0) {
                    this.processSectionContent(currentSection, currentContent.join('\n'));
                    currentProblem.sections.push(currentSection);
                }
                // End current problem with complete state reset
                doc.problems.push(currentProblem);
                currentProblem = null;
                resetProblemState(); // Complete reset
                continue;
            }
            // Only process sections if we're inside a problem
            if (!currentProblem) {
                continue;
            }
            // Check for section start
            const openSectionMatch = line.match(/^<<(blueprint|operational steps|ocaml code|proof|induction|invariant)(.*)$/);
            if (openSectionMatch) {
                const sectionName = openSectionMatch[1];
                const remainder = openSectionMatch[2].trim();
                // Handle nested sections like <<proof <<invariant
                if (remainder.startsWith('<<')) {
                    const nestedMatch = remainder.match(/^<<(invariant|induction)/);
                    if (nestedMatch) {
                        const nestedSection = nestedMatch[1];
                        // End previous section if exists
                        if (currentSection && sectionStack.length > 0) {
                            this.processSectionContent(currentSection, currentContent.join('\n'));
                            currentProblem.sections.push(currentSection);
                        }
                        // Start new proof section
                        currentSection = {
                            type: 'proof',
                            content: '',
                            subsections: {},
                            proofType: nestedSection,
                            proofSubsections: {}
                        };
                        // Clear stack and push both sections
                        sectionStack = [];
                        sectionStack.push({ name: sectionName, section: currentSection });
                        sectionStack.push({ name: nestedSection, section: currentSection });
                        currentContent = [];
                        continue;
                    }
                }
                // Check if we're already in a section and trying to open another at the top level
                if (sectionStack.length > 0) {
                    // End the current section before starting a new one
                    if (currentSection) {
                        this.processSectionContent(currentSection, currentContent.join('\n'));
                        currentProblem.sections.push(currentSection);
                    }
                    // Reset section state
                    currentSection = null;
                    currentContent = [];
                    sectionStack = [];
                }
                // Handle regular section opening
                sectionStack.push({ name: sectionName, section: null });
                // If this is a nested section, don't create a new section
                if (sectionStack.length > 1) {
                    if (sectionName === 'invariant' && currentSection?.type === 'proof') {
                        currentSection.proofType = 'invariant';
                        currentSection.proofSubsections = {};
                    }
                    else if (sectionName === 'induction' && currentSection?.type === 'proof') {
                        currentSection.proofType = 'induction';
                        currentSection.proofSubsections = {};
                    }
                }
                else {
                    // Start new section (we already ended the previous one above if needed)
                    let sectionType;
                    if (sectionName === 'operational steps') {
                        sectionType = 'operational_steps';
                    }
                    else if (sectionName === 'ocaml code') {
                        sectionType = 'ocaml_code';
                    }
                    else if (sectionName === 'proof' || sectionName === 'induction' || sectionName === 'invariant') {
                        sectionType = 'proof';
                    }
                    else {
                        sectionType = sectionName;
                    }
                    currentSection = {
                        type: sectionType,
                        content: '',
                        subsections: {}
                    };
                    if (sectionName === 'induction' || sectionName === 'invariant') {
                        currentSection.proofType = sectionName;
                        currentSection.proofSubsections = {};
                    }
                    sectionStack[sectionStack.length - 1].section = currentSection;
                    currentContent = [];
                }
                continue;
            }
            // Check for section end
            const closeSectionMatch = line.match(/^(blueprint|operational steps|ocaml code|proof|induction|invariant)>>$/);
            if (closeSectionMatch) {
                const closingSectionName = closeSectionMatch[1];
                // Only process if we have an active section stack
                if (sectionStack.length === 0) {
                    // Skip orphaned closing tags
                    continue;
                }
                // Find the matching opening section in the stack
                let foundIndex = -1;
                for (let j = sectionStack.length - 1; j >= 0; j--) {
                    if (sectionStack[j].name === closingSectionName) {
                        foundIndex = j;
                        break;
                    }
                }
                if (foundIndex !== -1) {
                    // Remove all sections from the found index onwards
                    sectionStack.splice(foundIndex);
                    // If we're closing the outermost section, end the main section
                    if (sectionStack.length === 0) {
                        if (currentSection) {
                            this.processSectionContent(currentSection, currentContent.join('\n'));
                            currentProblem.sections.push(currentSection);
                        }
                        currentSection = null;
                        currentContent = [];
                    }
                }
                continue;
            }
            // Add line to current section content
            if (sectionStack.length > 0) {
                currentContent.push(lines[i]);
            }
        }
        // Handle case where document ends without proper closing
        if (currentProblem) {
            // End current section if exists
            if (currentSection && sectionStack.length > 0) {
                this.processSectionContent(currentSection, currentContent.join('\n'));
                currentProblem.sections.push(currentSection);
            }
            doc.problems.push(currentProblem);
        }
        return doc;
    }
    processSectionContent(section, content) {
        section.content = content;
        switch (section.type) {
            case 'blueprint':
                this.parseBlueprint(section, content);
                break;
            case 'proof':
                this.parseProof(section, content);
                break;
            case 'operational_steps':
                this.parseOperationalSteps(section, content);
                break;
            case 'ocaml_code':
                this.parseOcamlCode(section, content);
                break;
        }
    }
    parseBlueprint(section, content) {
        section.subsections = {};
        const lines = content.split('\n');
        let currentSubsection = null;
        let currentContent = [];
        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            if (trimmed === 'requires:') {
                if (currentSubsection) {
                    section.subsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'requires';
                currentContent = [];
            }
            else if (trimmed === 'ensures:') {
                if (currentSubsection) {
                    section.subsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'ensures';
                currentContent = [];
            }
            else if (currentSubsection) {
                currentContent.push(line);
            }
        }
        if (currentSubsection) {
            section.subsections[currentSubsection] = currentContent.join('\n').trim();
        }
    }
    parseOperationalSteps(section, content) {
        section.subsections = {};
        const lines = content.split('\n');
        let currentStep = null;
        let currentContent = [];
        for (const line of lines) {
            // Skip empty lines and section markers
            if (!line.trim() || line.trim().startsWith('<<') || line.trim().endsWith('>>')) {
                continue;
            }
            const stepMatch = line.match(/^step (\d+):/i);
            if (stepMatch) {
                // Save previous step if exists
                if (currentStep) {
                    section.subsections[currentStep] = currentContent.join('\n').trim();
                }
                currentStep = `step-${stepMatch[1]}`;
                // Get content after the colon
                const afterColon = line.substring(line.indexOf(':') + 1).trim();
                currentContent = afterColon ? [afterColon] : [];
            }
            else if (currentStep) {
                // Add line to current step content
                currentContent.push(line);
            }
        }
        // Save the last step
        if (currentStep) {
            section.subsections[currentStep] = currentContent.join('\n').trim();
        }
    }
    parseProof(section, content) {
        section.subsections = {};
        section.proofSubsections = {};
        if (section.proofType === 'invariant') {
            this.parseInvariantProof(section, content);
        }
        else if (section.proofType === 'induction') {
            this.parseInductionProof(section, content);
        }
        else {
            // Try to determine proof type from content
            if (content.toLowerCase().includes('invariant')) {
                section.proofType = 'invariant';
                this.parseInvariantProof(section, content);
            }
            else if (content.toLowerCase().includes('induction')) {
                section.proofType = 'induction';
                this.parseInductionProof(section, content);
            }
        }
    }
    parseInvariantProof(section, content) {
        const lines = content.split('\n');
        let currentSubsection = null;
        let currentContent = [];
        for (const line of lines) {
            // Skip section markers
            if (line.trim().startsWith('<<') || line.trim().endsWith('>>')) {
                continue;
            }
            const trimmed = line.trim().toLowerCase();
            if (trimmed.startsWith('invariant condition:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'invariant-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            }
            else if (trimmed.startsWith('pre-condition:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'pre-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            }
            else if (trimmed.startsWith('after the ith iteration:') || trimmed.startsWith('after the ith step:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'ith-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            }
            else if (trimmed.startsWith('After the after the (i+1)th iteration:') || trimmed.startsWith('after the (i+1)th step:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'i-1th-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            }
            else if (trimmed.startsWith('post-condition:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'post-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            }
            else if (currentSubsection && trimmed) {
                currentContent.push(line);
            }
        }
        if (currentSubsection) {
            section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
        }
    }
    parseInductionProof(section, content) {
        const lines = content.split('\n');
        let currentSubsection = null;
        let currentContent = [];
        for (const line of lines) {
            // Skip section markers
            if (line.startsWith('<<') || line.endsWith('>>')) {
                continue;
            }
            const trimmed = line.toLowerCase();
            if (trimmed.startsWith('base case:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'base-case';
                const afterColon = line.substring(line.indexOf(':') + 1).trim();
                currentContent = afterColon ? [afterColon] : []; // Only add if there's content after colon
            }
            else if (trimmed.startsWith('induction hypothesis:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'induction-hypothesis';
                const afterColon = line.substring(line.indexOf(':') + 1).trim();
                currentContent = afterColon ? [afterColon] : []; // Only add if there's content after colon
            }
            else if (trimmed.startsWith('inductive step:')) {
                if (currentSubsection) {
                    section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'inductive-step';
                const afterColon = line.substring(line.indexOf(':') + 1).trim();
                currentContent = afterColon ? [afterColon] : []; // Only add if there's content after colon
            }
            else if (currentSubsection && trimmed) {
                currentContent.push(line);
            }
        }
        if (currentSubsection) {
            section.proofSubsections[currentSubsection] = currentContent.join('\n').trim();
        }
    }
    parseOcamlCode(section, content) {
        // OCaml code doesn't need special parsing, just store the content
        section.content = content;
    }
    generateHTML(doc) {
        return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="boop.css">
    <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.css" rel="stylesheet" />
    <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/line-numbers/prism-line-numbers.min.css" rel="stylesheet" />
    <title>ICS Document</title>
</head>

<body>
    <div class="header">
        <div class="header-title">BOOP! ICS Summer 2025 | Professor Aalok Thakkar</div>
        <img class="header-img" src="boop.png">
    </div>
    
    <div class="assignment-header">
        <div class="assignment-name">${doc.assignmentName}</div>
        <div class="student-name">${doc.studentName}</div>
        <div class="date">${doc.date}</div>
        <div class="collaborators">Collaborators: ${doc.collaborators}</div>
    </div>

    <div class="document-content">
        ${doc.problems.map(problem => this.generateProblemHTML(problem)).join('\n')}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-ocaml.min.js"></script>
</body>

</html>`;
    }
    generateProblemHTML(problem) {
        return `    <div class="problem">
        <div class="problem-title">${problem.title}</div>
        ${problem.sections.map(section => this.generateSectionHTML(section)).join('\n')}
    </div>`;
    }
    generateSectionHTML(section) {
        switch (section.type) {
            case 'blueprint':
                return this.generateBlueprintHTML(section);
            case 'operational_steps':
                return this.generateOperationalStepsHTML(section);
            case 'ocaml_code':
                return this.generateOCamlCodeHTML(section);
            case 'proof':
                return this.generateProofHTML(section);
            default:
                return '';
        }
    }
    generateBlueprintHTML(section) {
        let html = `        <div class="section">
            <div class="blueprint-header section-header">BLUEPRINT</div>
            <div class="blueprint">`;
        if (section.subsections?.requires) {
            html += `
                <div class="blueprint-requires sub-section">
                    <span class="blueprint-requires-header">Requires: </span> <br>
                    ${this.formatLines(section.subsections.requires)}
                </div>`;
        }
        if (section.subsections?.ensures) {
            html += `
                <div class="blueprint-ensures sub-section">
                    <span class="blueprint-ensures-header">Ensures: </span> <br>
                    ${this.formatLines(section.subsections.ensures)}
                </div>`;
        }
        html += `
            </div>
        </div>`;
        return html;
    }
    generateOperationalStepsHTML(section) {
        let html = `        <div class="section">
            <div class="operational-steps-header section-header">OPERATIONAL STEPS</div>
            <div class="operational-steps">`;
        if (section.subsections) {
            const sortedSteps = Object.keys(section.subsections)
                .filter(key => key.startsWith('step-'))
                .sort((a, b) => {
                const aNum = parseInt(a.split('-')[1]);
                const bNum = parseInt(b.split('-')[1]);
                return aNum - bNum;
            });
            for (const stepKey of sortedSteps) {
                const stepNum = stepKey.split('-')[1];
                const stepContent = section.subsections[stepKey];
                html += `
                <div class="step sub-section" id="step-${stepNum}">
                    <span class="step-header">Step ${stepNum}: </span> <br>
                    ${this.escapeHtml(stepContent)}
                </div>`;
            }
        }
        html += `
            </div>
        </div>`;
        return html;
    }
    generateOCamlCodeHTML(section) {
        let ocaml_code = section.content.trim();
        let status = "";
        const ppxDir = path.resolve(__dirname, '../../ICSLang/ppx_1');
        const tempDir = ppxDir;
        if (!fs.existsSync(tempDir))
            fs.mkdirSync(tempDir, { recursive: true });
        const tempFile = path.join(ppxDir, `section_${Date.now()}.ml`);
        fs.writeFileSync(tempFile, ocaml_code);
        try {
            const result = (0, child_process_1.execSync)(`eval $(opam env)
        dune exec ./bin/checker.exe -- ${tempFile} ${allowed_flags}`, {
                encoding: 'utf-8',
                stdio: 'pipe',
                cwd: ppxDir
            });
            status = "Verified";
        }
        catch (err) {
            console.error(err.stderr || err.message);
            status = "Failed";
            vscode.window.showErrorMessage(`🐫 OOPSCaml! ERROR`);
        }
        finally {
            // Delete the temporary file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
        return `        <div class="section">
    <div class="ocaml-code-header section-header">OCAML CODE
    </div>
    <div class="ocaml-code">
    <!--<div class="code-${status}">ICS Check: ${status}</div>-->
        <div class="code sub-section">
            <pre class="line-numbers"><code class="language-ocaml">${section.content}</code></pre>
        </div>
    </div>
</div>`;
    }
    generateProofHTML(section) {
        let html = `        <div class="section">
            <div class="proof-header section-header">PROOF</div>
            <div class="proof">`;
        if (section.proofType === 'invariant') {
            html += `
                <div class="proof-sub-header section-header">INVARIANT</div>`;
            if (section.proofSubsections) {
                // Invariant condition
                if (section.proofSubsections['invariant-condition']) {
                    html += `
                <div class="invariant inv-condition">
                    <span class="invariant-header">Invariant Condition: </span> <br>
                    ${this.formatLines(section.proofSubsections['invariant-condition'])}
                </div>`;
                }
                // Pre-condition
                if (section.proofSubsections['pre-condition']) {
                    html += `
                <div class="invariant pre-condition sub-section">
                    <span class="invariant-header">Pre-condition: </span> <br>
                    ${this.formatLines(section.proofSubsections['pre-condition'])}
                </div>`;
                }
                // After ith iteration
                if (section.proofSubsections['ith-condition']) {
                    html += `
                <div class="invariant ith-condition">
                    <span class="invariant-header">After the ith iteration: </span> <br>
                    ${this.formatLines(section.proofSubsections['ith-condition'])}
                </div>`;
                }
                // After after the (i+1)th stepth iteration
                if (section.proofSubsections['i-1th-condition']) {
                    html += `
                <div class="invariant i-1th-condition">
                    <span class="invariant-header">After the after the (i+1)th iteration: </span> <br>
                    ${this.formatLines(section.proofSubsections['i-1th-condition'])}
                </div>`;
                }
                // Post-condition
                if (section.proofSubsections['post-condition']) {
                    html += `
                <div class="invariant post-condition">
                    <span class="invariant-header">Post-condition: </span> <br>
                    ${this.formatLines(section.proofSubsections['post-condition'])}
                </div>`;
                }
            }
        }
        else if (section.proofType === 'induction') {
            html += `
                <div class="proof-sub-header section-header">INDUCTION</div>`;
            if (section.proofSubsections) {
                // Base case
                if (section.proofSubsections['base-case']) {
                    html += `
                <div class="induction base-case sub-section">
                    <span class="invariant-header">Base Case: </span> <br>
                    ${this.formatLines(section.proofSubsections['base-case'])}
                </div>`;
                }
                // Induction hypothesis
                if (section.proofSubsections['induction-hypothesis']) {
                    html += `
                <div class="induction induction-hypothesis sub-section">
                    <span class="invariant-header">Induction Hypothesis: </span> <br>
                    ${this.formatLines(section.proofSubsections['induction-hypothesis'])}
                </div>`;
                }
                // Inductive step
                if (section.proofSubsections['inductive-step']) {
                    html += `
                <div class="induction inductive-step sub-section">
                    <span class="invariant-header">Inductive Step: </span> <br>
                    ${this.formatLines(section.proofSubsections['inductive-step'])}
                </div>`;
                }
            }
        }
        html += `
            </div>
        </div>`;
        return html;
    }
    formatLines(content) {
        // Format line references
        const lineRefRegex = /line (\d+)/g;
        return this.escapeHtml(content).replace(lineRefRegex, '<span class="line-ref">line $1</span>').replace(/\n/g, '<br>');
    }
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        // First escape HTML characters, then convert newlines to <br> tags
        return text.replace(/[&<>"']/g, (m) => map[m]).replace(/\n/g, '<br>');
    }
    generateCSS() {
        return `:root {
    --blue: #3674B5;
    --purple: #7F55B1;
    --orange: #ef7f08;
    --green: #096B68;
}

* {
    font-family: 'Courier New', Courier, monospace;
}

body {
    display: flex;
    flex-direction: column;
    font-weight: 550;
}

.assignment-name {
    font-size: 32px;
    font-weight: bold;
    text-align: center;
}

.student-name,
.date,
.collaborators,
.verified {
    font-size: 20px;
}

.assignment-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 20px;
    border: 2px solid black;
    padding: 10px;
    width: 60%;
    align-self: center;
}

.header {
    display: flex;
    height: 100px;
    align-items: self-end;
    justify-content: space-between;
    width: 100%;
    padding-bottom: 10px;
    border-bottom: 1px solid #000;
    margin-bottom: 20px;
}

.header .header-title {
    font-size: 16px;
}

.header .header-img {
    height: inherit;
    width: auto;
}

.begin-problem {
    margin: 20px;
}

.problem-title {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 10px;
    margin-left: 0px;
    margin-top: 40px;
}

.blueprint-requires-header,
.blueprint-ensures-header,
.step-header,
.invariant-header {
    font-weight: 1000;
    background-color: var(--blue);
    color: white;
    padding: 5px;
    border-radius: 5px;
    opacity: 0.8;
}

.step-header {
    background-color: var(--purple);
}

.invariant-header {
    background-color: var(--green);
}

.section-header {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
    color: white;
    padding: 5px;
    border-radius: 5px;
    width: auto;
    padding-left: 10px;
}

.blueprint-header {
    background-color: var(--blue);
}

.operational-steps-header {
    background-color: var(--purple);
}

.ocaml-code-header {
    background-color: var(--orange);
}

.proof-header {
    background-color: var(--green);
}

.proof-sub-header {
    color: var(--green);
    padding-left: 0;
}

.blueprint {
    border-left: 5px solid var(--blue);
    padding-left: 10px;
}

.operational-steps {
    border-left: 5px solid var(--purple);
    padding-left: 10px;
}

.ocaml-code {
    border-left: 5px solid var(--orange);
    padding-left: 10px;
}

.proof {
    border-left: 5px solid var(--green);
    padding-left: 10px;
}

.section {
    margin: 20px 0 20px 0px;
    line-height: 30px;
}

.line-ref {
    color: var(--green);
    font-weight: bold;
    text-decoration: underline;
    font-style: italic;
}

.sub-section {
    margin-bottom: 15px;
}

.invariant {
    margin-bottom: 15px;
}

        .code {
            background: black;
            color: white;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }

        .code pre {
            margin: 0;
            white-space: pre-wrap;
            background: transparent;
            color: inherit;
        }

        .code pre code {
            background: transparent;
            color: inherit;
            font-family: 'Courier New', Consolas, Monaco, monospace;
        }

        /* Add Prism-specific overrides */
        .code .token.comment,
        .code .token.prolog,
        .code .token.doctype,
        .code .token.cdata {
            color: #6a9955;
        }

        .code .token.keyword {
            color: #569cd6;
        }

        .code .token.string {
            color: #ce9178;
        }

        .code .token.number {
            color: #b5cea8;
        }

        .code .token.operator {
            color: #d4d4d4;
        }
.code-Verified {
    background-color: green;
    color: white;
    padding: 5px;
    border-radius: 5px;
    width: 200px;
    opacity 0.5;
    margin-left: 10px;
    text-align: center;
    margin-bottom: 5px;
}

.code-Failed {
    background-color: red;
    color: white;
    padding: 5px;
    border-radius: 5px;
    width: 170px;
    opacity 0.5;
    margin-left: 10px
    text-align: center;
    margin-bottom: 5px;
}
`;
    }
}
exports.ICSCompiler = ICSCompiler;
//# sourceMappingURL=compiler-old.js.map