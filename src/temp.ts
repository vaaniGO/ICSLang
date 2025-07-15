import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ICSSection {
    type: 'blueprint' | 'operational_steps' | 'ocaml_code' | 'proof';
    content: string;
    subsections?: { [key: string]: string };
    proofType?: 'induction' | 'invariant';
    proofSubsections?: { [key: string]: string };
}

export interface ICSProblem {
    title: string;
    sections: ICSSection[];
}

export interface ICSDocument {
    assignmentName: string;
    studentName: string;
    date: string;
    collaborators: string;
    verified: string;
    problems: ICSProblem[];
}

export class ICSCompiler {
    private outputPath: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('ics');
        let outputPath = config.get('outputPath', './output');

        // Resolve path relative to workspace
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (!path.isAbsolute(outputPath)) {
                this.outputPath = path.resolve(workspaceRoot, outputPath);
            } else {
                this.outputPath = outputPath;
            }
        } else {
            this.outputPath = path.resolve(process.cwd(), outputPath);
        }
    }

    private getOutputPath(fileName: string): string {
        const config = vscode.workspace.getConfiguration('ics');
        let outputPath = config.get('outputPath', './output');

        const documentDir = path.dirname(fileName);
        let resolvedOutputPath: string;

        if (path.isAbsolute(outputPath)) {
            resolvedOutputPath = outputPath;
        } else {
            resolvedOutputPath = path.resolve(documentDir, outputPath);
        }

        const baseName = path.basename(fileName, '.ics');
        return path.join(resolvedOutputPath, `${baseName}.html`);
    }

    async compile(document: vscode.TextDocument) {
        try {
            const parsed = this.parseDocument(document);
            if (!parsed) {
                vscode.window.showErrorMessage('Failed to parse ICS document');
                return;
            }

            const html = this.generateHTML(parsed);
            const outputFile = this.getOutputPath(document.fileName);

            // Ensure output directory exists
            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputFile, html);

            // Generate CSS file
            const cssFile = path.join(outputDir, 'boop.css');
            fs.writeFileSync(cssFile, this.generateCSS());

            vscode.window.showInformationMessage(`ICS compiled successfully to ${outputFile}`);

            // Open the compiled HTML file
            const uri = vscode.Uri.file(outputFile);
            vscode.env.openExternal(uri);

        } catch (error) {
            vscode.window.showErrorMessage(`Compilation failed: ${error}`);
        }
    }

    private parseDocument(document: vscode.TextDocument): ICSDocument | null {
        const content = document.getText();
        const lines = content.split('\n');

        const doc: ICSDocument = {
            assignmentName: '',
            studentName: '',
            date: '',
            collaborators: '',
            verified: '',
            problems: []
        };

        let currentProblem: ICSProblem | null = null;
        let currentSection: ICSSection | null = null;
        let currentContent: string[] = [];
        let inProblem = false;
        let inSection = false;
        let inHeader = false;
        let sectionStack: { name: string; section: ICSSection | null }[] = [];

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
                } else if (line.startsWith('student:')) {
                    doc.studentName = line.substring(8).trim();
                } else if (line.startsWith('date:')) {
                    doc.date = line.substring(5).trim();
                } else if (line.startsWith('collaborators:')) {
                    doc.collaborators = line.substring(14).trim();
                } else if (line.startsWith('verified:')) {
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
                if (currentProblem && inProblem) {
                    // End current section if exists
                    if (currentSection && inSection) {
                        this.processSectionContent(currentSection, currentContent.join('\n'));
                        currentProblem.sections.push(currentSection);
                    }
                    doc.problems.push(currentProblem);
                }

                // Start new problem
                currentProblem = {
                    title: problemStartMatch[1].trim(),
                    sections: []
                };
                currentSection = null;
                currentContent = [];
                inProblem = true;
                inSection = false;
                sectionStack = [];
                continue;
            }

            // Check for problem end
            if (line === 'problem>>' && inProblem) {
                // End current section if exists
                if (currentSection && inSection) {
                    this.processSectionContent(currentSection, currentContent.join('\n'));
                    currentProblem!.sections.push(currentSection);
                }

                // End current problem
                if (currentProblem) {
                    doc.problems.push(currentProblem);
                }

                currentProblem = null;
                currentSection = null;
                currentContent = [];
                inProblem = false;
                inSection = false;
                sectionStack = [];
                continue;
            }

            // Only process sections if we're inside a problem
            if (!inProblem) {
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
                        if (currentSection && inSection) {
                            this.processSectionContent(currentSection, currentContent.join('\n'));
                            currentProblem!.sections.push(currentSection);
                        }

                        // Start new proof section
                        currentSection = {
                            type: 'proof',
                            content: '',
                            subsections: {},
                            proofType: nestedSection as 'induction' | 'invariant',
                            proofSubsections: {}
                        };

                        sectionStack.push({ name: sectionName, section: currentSection });
                        sectionStack.push({ name: nestedSection, section: currentSection });
                        currentContent = [];
                        inSection = true;
                        continue;
                    }
                }

                // Handle regular section opening
                sectionStack.push({ name: sectionName, section: null });

                // If this is a nested section, don't create a new section
                if (sectionStack.length > 1) {
                    if (sectionName === 'invariant' && currentSection?.type === 'proof') {
                        currentSection.proofType = 'invariant';
                        currentSection.proofSubsections = {};
                    } else if (sectionName === 'induction' && currentSection?.type === 'proof') {
                        currentSection.proofType = 'induction';
                        currentSection.proofSubsections = {};
                    }
                } else {
                    // End previous section if exists
                    if (currentSection && inSection) {
                        this.processSectionContent(currentSection, currentContent.join('\n'));
                        currentProblem!.sections.push(currentSection);
                    }

                    // Start new section
                    let sectionType: ICSSection['type'];

                    if (sectionName === 'operational steps') {
                        sectionType = 'operational_steps';
                    } else if (sectionName === 'ocaml code') {
                        sectionType = 'ocaml_code';
                    } else if (sectionName === 'proof' || sectionName === 'induction' || sectionName === 'invariant') {
                        sectionType = 'proof';
                    } else {
                        sectionType = sectionName as ICSSection['type'];
                    }

                    currentSection = {
                        type: sectionType,
                        content: '',
                        subsections: {}
                    };

                    if (sectionName === 'induction' || sectionName === 'invariant') {
                        currentSection.proofType = sectionName as 'induction' | 'invariant';
                        currentSection.proofSubsections = {};
                    }

                    sectionStack[sectionStack.length - 1].section = currentSection;
                    currentContent = [];
                    inSection = true;
                }
                continue;
            }

            // Check for section end
            const closeSectionMatch = line.match(/^(blueprint|operational steps|ocaml code|proof|induction|invariant)>>$/);
            if (closeSectionMatch) {
                const closingSectionName = closeSectionMatch[1];

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
                        if (currentSection && inSection) {
                            this.processSectionContent(currentSection, currentContent.join('\n'));
                            currentProblem!.sections.push(currentSection);
                        }

                        currentSection = null;
                        currentContent = [];
                        inSection = false;
                    }
                }
                continue;
            }

            // Add line to current section content
            if (inSection) {
                currentContent.push(lines[i]);
            }
        }

        // Handle case where document ends without proper closing
        if (currentProblem && inProblem) {
            // End current section if exists
            if (currentSection && inSection) {
                this.processSectionContent(currentSection, currentContent.join('\n'));
                currentProblem.sections.push(currentSection);
            }
            doc.problems.push(currentProblem);
        }

        return doc;
    }

    private processSectionContent(section: ICSSection, content: string) {
        section.content = content.trim();

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
                // OCaml code doesn't need special parsing
                break;
        }
    }

    private parseBlueprint(section: ICSSection, content: string) {
        section.subsections = {};
        const lines = content.split('\n');
        let currentSubsection: string | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            if (trimmed === 'requires:') {
                if (currentSubsection) {
                    section.subsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'requires';
                currentContent = [];
            } else if (trimmed === 'ensures:') {
                if (currentSubsection) {
                    section.subsections[currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'ensures';
                currentContent = [];
            } else if (currentSubsection) {
                currentContent.push(line);
            }
        }

        if (currentSubsection) {
            section.subsections[currentSubsection] = currentContent.join('\n').trim();
        }
    }

    private parseOperationalSteps(section: ICSSection, content: string) {
        section.subsections = {};
        const lines = content.split('\n');
        let currentStep: string | null = null;
        let currentContent: string[] = [];

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
            } else if (currentStep) {
                // Add line to current step content
                currentContent.push(line);
            }
        }

        // Save the last step
        if (currentStep) {
            section.subsections[currentStep] = currentContent.join('\n').trim();
        }
    }

    private parseProof(section: ICSSection, content: string) {
        section.subsections = {};
        section.proofSubsections = {};

        if (section.proofType === 'invariant') {
            this.parseInvariantProof(section, content);
        } else if (section.proofType === 'induction') {
            this.parseInductionProof(section, content);
        } else {
            // Try to determine proof type from content
            if (content.toLowerCase().includes('invariant')) {
                section.proofType = 'invariant';
                this.parseInvariantProof(section, content);
            } else if (content.toLowerCase().includes('induction')) {
                section.proofType = 'induction';
                this.parseInductionProof(section, content);
            }
        }
    }

    private parseInvariantProof(section: ICSSection, content: string) {
        const lines = content.split('\n');
        let currentSubsection: string | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            // Skip section markers
            if (line.trim().startsWith('<<') || line.trim().endsWith('>>')) {
                continue;
            }

            const trimmed = line.trim().toLowerCase();

            if (trimmed.startsWith('invariant condition:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'invariant-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (trimmed.startsWith('pre-condition:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'pre-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (trimmed.startsWith('after the ith iteration:') || trimmed.startsWith('after the ith step:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'ith-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (trimmed.startsWith('after the after the (i+1)th stepth iteration:') || trimmed.startsWith('after the (i+1)th step:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'i-1th-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (trimmed.startsWith('post-condition:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'post-condition';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (currentSubsection && trimmed) {
                currentContent.push(line);
            }
        }

        if (currentSubsection) {
            section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
        }
    }

    private parseInductionProof(section: ICSSection, content: string) {
        const lines = content.split('\n');
        let currentSubsection: string | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            // Skip section markers
            if (line.trim().startsWith('<<') || line.trim().endsWith('>>')) {
                continue;
            }

            const trimmed = line.trim().toLowerCase();

            if (trimmed.startsWith('base case:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'base-case';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (trimmed.startsWith('induction hypothesis:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'induction-hypothesis';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (trimmed.startsWith('inductive step:')) {
                if (currentSubsection) {
                    section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
                }
                currentSubsection = 'inductive-step';
                currentContent = [line.substring(line.indexOf(':') + 1).trim()];
            } else if (currentSubsection && trimmed) {
                currentContent.push(line);
            }
        }

        if (currentSubsection) {
            section.proofSubsections![currentSubsection] = currentContent.join('\n').trim();
        }
    }

    private generateHTML(doc: ICSDocument): string {
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
        <div class="verified">Formally verified? ${doc.verified}</div>
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

    private generateProblemHTML(problem: ICSProblem): string {
        return `    <div class="problem">
        <div class="problem-title">${problem.title}</div>
        ${problem.sections.map(section => this.generateSectionHTML(section)).join('\n')}
    </div>`;
    }

    private generateSectionHTML(section: ICSSection): string {
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

    private generateBlueprintHTML(section: ICSSection): string {
        let html = `        <div class="section">
            <div class="blueprint-header section-header">BLUEPRINT</div>
            <div class="blueprint">`;

        if (section.subsections?.requires) {
            html += `
                <div class="blueprint-requires sub-section">
                    <span class="blueprint-requires-header">Requires: </span> <br>
                    ${this.escapeHtml(section.subsections.requires)}
                </div>`;
        }

        if (section.subsections?.ensures) {
            html += `
                <div class="blueprint-ensures sub-section">
                    <span class="blueprint-ensures-header">Ensures: </span> <br>
                    ${this.escapeHtml(section.subsections.ensures)}
                </div>`;
        }

        html += `
            </div>
        </div>`;

        return html;
    }

    private generateOperationalStepsHTML(section: ICSSection): string {
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

    private generateOCamlCodeHTML(section: ICSSection): string {
        return `        <div class="section">
            <div class="ocaml-code-header section-header">OCAML CODE</div>
            <div class="ocaml-code">
                <div class="code sub-section">
                    <pre class="line-numbers"><code class="language-ocaml">${this.escapeHtml(section.content)}</code></pre>
                </div>
            </div>
        </div>`;
    }

    private generateProofHTML(section: ICSSection): string {
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
                    ${this.formatProofContent(section.proofSubsections['invariant-condition'])}
                </div>`;
                }

                // Pre-condition
                if (section.proofSubsections['pre-condition']) {
                    html += `
                <div class="invariant pre-condition sub-section">
                    <span class="invariant-header">Pre-condition: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['pre-condition'])}
                </div>`;
                }

                // After ith iteration
                if (section.proofSubsections['ith-condition']) {
                    html += `
                <div class="invariant ith-condition">
                    <span class="invariant-header">After the ith iteration: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['ith-condition'])}
                </div>`;
                }

                // After after the (i+1)th stepth iteration
                if (section.proofSubsections['i-1th-condition']) {
                    html += `
                <div class="invariant i-1th-condition">
                    <span class="invariant-header">After the after the (i+1)th stepth iteration: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['i-1th-condition'])}
                </div>`;
                }

                // Post-condition
                if (section.proofSubsections['post-condition']) {
                    html += `
                <div class="invariant post-condition">
                    <span class="invariant-header">Post-condition: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['post-condition'])}
                </div>`;
                }
            }
        } else if (section.proofType === 'induction') {
            html += `
                <div class="proof-sub-header section-header">INDUCTION</div>`;

            if (section.proofSubsections) {
                // Base case
                if (section.proofSubsections['base-case']) {
                    html += `
                <div class="induction base-case sub-section">
                    <span class="invariant-header">Base Case: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['base-case'])}
                </div>`;
                }

                // Induction hypothesis
                if (section.proofSubsections['induction-hypothesis']) {
                    html += `
                <div class="induction induction-hypothesis sub-section">
                    <span class="invariant-header">Induction Hypothesis: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['induction-hypothesis'])}
                </div>`;
                }

                // Inductive step
                if (section.proofSubsections['inductive-step']) {
                    html += `
                <div class="induction inductive-step sub-section">
                    <span class="invariant-header">Inductive Step: </span> <br>
                    ${this.formatProofContent(section.proofSubsections['inductive-step'])}
                </div>`;
                }
            }
        }

        html += `
            </div>
        </div>`;

        return html;
    }

    private formatProofContent(content: string): string {
        // Format line references
        const lineRefRegex = /line (\d+)/g;
        return this.escapeHtml(content).replace(lineRefRegex, '<span class="line-ref">line $1</span>');
    }

    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    private generateCSS(): string {
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
    background: transparent;
    color: inherit;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
}

.code pre {
    margin: 0;
    white-space: pre-wrap;
    background: transparent;
}

.code pre code {
    background: transparent;
}

.step {
    margin-bottom: 15px;
}

/* Prism.js styling compatibility */
.line-numbers {
    position: relative;
    padding-left: 3.8em;
    counter-reset: linenumber;
}

.line-numbers > code {
    position: relative;
    white-space: inherit;
}

.line-numbers .line-numbers-rows {
    position: absolute;
    pointer-events: none;
    top: 0;
    font-size: 100%;
    left: -3.8em;
    width: 3em;
    letter-spacing: -1px;
    border-right: 1px solid #999;
    user-select: none;
}`;
    }
}