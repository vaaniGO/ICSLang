import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { ICSCompiler } from './compiler';
import { ICSValidator } from './validator';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    console.log('ICS Language Support extension is now active!');

    // Register completion provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'ics',
        new ICSCompletionProvider(),
        '<', // Trigger on < for <<sections
        's'   // Trigger on 's' for step references
    );

    // Register hover provider for step references
    const hoverProvider = vscode.languages.registerHoverProvider(
        'ics',
        new ICSHoverProvider()
    );

    // Register definition provider for step references
    const definitionProvider = vscode.languages.registerDefinitionProvider(
        'ics',
        new ICSDefinitionProvider()
    );

    // Register semantic tokens provider for syntax highlighting
    const semanticTokensProvider = vscode.languages.registerDocumentSemanticTokensProvider(
        'ics',
        new ICSSemanticTokensProvider(),
        new vscode.SemanticTokensLegend(['keyword', 'stepReference'], ['blue', 'purple', 'orange', 'green', 'cyan', 'yellow'])
    );

    // Register folding range provider for collapsible sections
    const foldingRangeProvider = vscode.languages.registerFoldingRangeProvider(
        'ics',
        new ICSFoldingRangeProvider()
    );

    // Register compile command
    const compileCommand = vscode.commands.registerCommand('ics.compile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ics') {
            vscode.window.showErrorMessage('Please open an ICS file to compile');
            return;
        }

        const compiler = new ICSCompiler();
        compiler.compile(editor.document);
    });

    const execAsync = promisify(exec);

    const a1_compileCommand = vscode.commands.registerCommand('ics.compile_a1', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ics') {
            vscode.window.showErrorMessage('Please open an ICS file to compile');
            return;
        }

        let originalFirstLine = '';
        const compilerPath = path.join(__dirname, '/../src/compiler.ts');

        try {
            // Read assignment_1.txt content
            const assignmentPath = path.join(__dirname, '/../src/assignment_1.txt');
            const assignmentContent = fs.readFileSync(assignmentPath, 'utf8');

            // Read compiler.ts content
            const compilerContent = fs.readFileSync(compilerPath, 'utf8');
            const lines = compilerContent.split('\n');

            // Store the first line temporarily and remove it
            originalFirstLine = lines[0];
            const contentWithoutFirstLine = lines.slice(1).join('\n');

            // Insert assignment content at the beginning
            const modifiedContent = assignmentContent + '\n' + contentWithoutFirstLine;
            fs.writeFileSync(compilerPath, modifiedContent);

            // Recompile TypeScript
            await execAsync('npm run compile', { cwd: path.join(__dirname, '/..') });

            // Clear the module cache
            const compiledPath = path.join(__dirname, '/compiler.js');
            delete require.cache[require.resolve(compiledPath)];

            // Now import and use
            const { ICSCompiler } = require(compiledPath);
            const compiler = new ICSCompiler();
            await compiler.compile(editor.document);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`🐫 OOPSCaml! ERROR: ${errorMessage}`);
        } finally {
            // Cleanup and recompile again
            try {
                const currentContent = fs.readFileSync(compilerPath, 'utf8');
                const lines = currentContent.split('\n');

                const assignmentPath = path.join(__dirname, '/../src/assignment_1.txt');
                const assignmentContent = fs.readFileSync(assignmentPath, 'utf8');
                const assignmentLines = assignmentContent.split('\n');

                const remainingLines = lines.slice(assignmentLines.length);
                const restoredContent = [originalFirstLine, ...remainingLines].join('\n');
                fs.writeFileSync(compilerPath, restoredContent);

                // Recompile again to restore
                await execAsync('npm run compile', { cwd: path.join(__dirname, '/..') });

                // Clear cache
                const compiledPath = path.join(__dirname, '/compiler.js');
                if (require.cache[require.resolve(compiledPath)]) {
                    delete require.cache[require.resolve(compiledPath)];
                }

            } catch (cleanupError) {
                const cleanupErrorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                vscode.window.showErrorMessage(`🐫 OOPSCaml! ERROR: ${cleanupErrorMessage}`);
            }
        }
    });
    // Register validate command
    const validateCommand = vscode.commands.registerCommand('ics.validate', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ics') {
            vscode.window.showErrorMessage('Please open an ICS file to validate');
            return;
        }

        const validator = new ICSValidator();
        validator.validate(editor.document);
    });

    // Register diagnostic provider
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('ics');
    const validator = new ICSValidator();

    // Validate on document change
    const validateDocument = (document: vscode.TextDocument) => {
        if (document.languageId === 'ics') {
            const diagnostics = validator.getDiagnostics(document);
            diagnosticCollection.set(document.uri, diagnostics);
        }
    };

    // Initial validation and setup watchers
    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document);
    }

    const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            validateDocument(editor.document);
        }
    });

    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
        validateDocument(event.document);
    });

    context.subscriptions.push(
        completionProvider,
        hoverProvider,
        definitionProvider,
        semanticTokensProvider,
        foldingRangeProvider,
        compileCommand,
        a1_compileCommand,
        validateCommand,
        diagnosticCollection,
        onDidChangeActiveTextEditor,
        onDidChangeTextDocument
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

class ICSFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        const foldingRanges: vscode.FoldingRange[] = [];
        const sectionStack: { name: string; startLine: number; kind: vscode.FoldingRangeKind }[] = [];

        // Main sections that should be collapsible
        const mainSections = ['problem', 'blueprint', 'operational steps', 'ocaml code', 'proof', 'header'];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();

            // Check for section start (<<section)
            const sectionStartMatch = line.match(/^<<(.+)$/);
            if (sectionStartMatch) {
                const sectionName = sectionStartMatch[1].trim();

                // Determine if this is a main section or nested section
                const isMainSection = mainSections.includes(sectionName);
                const kind = isMainSection ? vscode.FoldingRangeKind.Region : vscode.FoldingRangeKind.Comment;

                sectionStack.push({
                    name: sectionName,
                    startLine: i,
                    kind: kind
                });
                continue;
            }

            // Check for section end (section>>)
            const sectionEndMatch = line.match(/^(.+)>>$/);
            if (sectionEndMatch) {
                const sectionName = sectionEndMatch[1].trim();

                // Find the matching opening section
                for (let j = sectionStack.length - 1; j >= 0; j--) {
                    if (sectionStack[j].name === sectionName) {
                        const section = sectionStack[j];

                        // Only create folding range if there's content between start and end
                        if (i > section.startLine) {
                            foldingRanges.push(new vscode.FoldingRange(
                                section.startLine,
                                i - 1, // End one line before the closing tag
                                section.kind
                            ));
                        }

                        // Remove this section and all nested sections
                        sectionStack.splice(j);
                        break;
                    }
                }
                continue;
            }

            // Check for problem sections (like "problem 1:")
            const problemMatch = line.match(/^<<problem\s+\d+:/);
            if (problemMatch) {
                sectionStack.push({
                    name: 'problem',
                    startLine: i,
                    kind: vscode.FoldingRangeKind.Region
                });
                continue;
            }

            // Check for problem end
            if (line === 'problem>>') {
                for (let j = sectionStack.length - 1; j >= 0; j--) {
                    if (sectionStack[j].name === 'problem') {
                        const section = sectionStack[j];

                        if (i > section.startLine) {
                            foldingRanges.push(new vscode.FoldingRange(
                                section.startLine,
                                i - 1,
                                section.kind
                            ));
                        }

                        sectionStack.splice(j);
                        break;
                    }
                }
                continue;
            }
        }

        return foldingRanges;
    }
}

class ICSSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
        const tokensBuilder = new vscode.SemanticTokensBuilder();
        const content = document.getText();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Check for section headers and apply appropriate colors
            if (trimmed.match(/^<<blueprint$/) || trimmed.match(/^blueprint>>$/)) {
                const startPos = line.indexOf('<<blueprint') !== -1 ? line.indexOf('<<blueprint') : line.indexOf('blueprint>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 0); // blue
            } else if (trimmed.match(/^<<operational steps$/) || trimmed.match(/^operational steps>>$/)) {
                const startPos = line.indexOf('<<operational steps') !== -1 ? line.indexOf('<<operational steps') : line.indexOf('operational steps>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 1); // purple
            } else if (trimmed.match(/^<<ocaml code$/) || trimmed.match(/^ocaml code>>$/)) {
                const startPos = line.indexOf('<<ocaml code') !== -1 ? line.indexOf('<<ocaml code') : line.indexOf('ocaml code>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 2); // orange
            } else if (trimmed.match(/^<<(proof|induction|invariant)$/) || trimmed.match(/^(proof|induction|invariant)>>$/)) {
                const startPos = line.search(/<<(proof|induction|invariant)|((proof|induction|invariant)>>)/);
                if (startPos !== -1) {
                    tokensBuilder.push(i, startPos, trimmed.length, 0, 3); // green
                }
            } else if (trimmed.match(/^<<header$/) || trimmed.match(/^header>>$/)) {
                const startPos = line.indexOf('<<header') !== -1 ? line.indexOf('<<header') : line.indexOf('header>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 4); // cyan
            }

            // Highlight step references outside of operational steps section
            if (!this.isInOperationalSteps(document, i)) {
                const stepReferences = line.match(/step \d+/g);
                if (stepReferences) {
                    stepReferences.forEach(stepRef => {
                        const startPos = line.indexOf(stepRef);
                        if (startPos !== -1) {
                            tokensBuilder.push(i, startPos, stepRef.length, 1, 5); // stepReference token type, yellow color
                        }
                    });
                }
            }
        }

        return tokensBuilder.build();
    }

    private isInOperationalSteps(document: vscode.TextDocument, lineNumber: number): boolean {
        let inOperationalSteps = false;

        for (let i = 0; i <= lineNumber; i++) {
            const line = document.lineAt(i).text.trim();

            if (line === '<<operational steps') {
                inOperationalSteps = true;
            } else if (line === 'operational steps>>') {
                inOperationalSteps = false;
            }
        }

        return inOperationalSteps;
    }
}

class ICSCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completions: vscode.CompletionItem[] = [];

        // Main section completions - changed to << syntax
        if (linePrefix.endsWith('<<')) {
            completions.push(
                this.createSectionCompletion('blueprint', 'Blueprint section with requires and ensures'),
                this.createSectionCompletion('operational steps', 'Operational steps section'),
                this.createSectionCompletion('ocaml code', 'OCaml code section'),
                this.createSectionCompletion('proof', 'Proof section'),
                this.createSectionCompletion('induction', 'Induction proof'),
                this.createSectionCompletion('invariant', 'Invariant proof'),
                this.createSectionCompletion('header', 'Header section with document metadata')
            );
        }

        // Enhanced step reference completions - trigger on "step" or "step "
        if (linePrefix.match(/step\s*$/i) || linePrefix.match(/step\s+\d*$/i)) {
            // Only provide step completions if we're NOT in operational steps section
            if (!this.isInOperationalSteps(document, position.line)) {
                const stepRefs = this.getStepReferences(document);
                stepRefs.forEach(step => {
                    const completion = new vscode.CompletionItem(
                        `step ${step.number}`,
                        vscode.CompletionItemKind.Reference
                    );
                    completion.detail = `Reference to step ${step.number}`;
                    completion.documentation = new vscode.MarkdownString(`**Step ${step.number}**: ${step.text}`);
                    completion.insertText = `step ${step.number}`;
                    completion.sortText = `step_${step.number.toString().padStart(3, '0')}`; // Ensure proper sorting

                    // Add command to navigate to step definition
                    completion.command = {
                        command: 'vscode.open',
                        title: 'Go to step definition',
                        arguments: [document.uri, { selection: new vscode.Range(step.line, 0, step.line, step.text.length) }]
                    };

                    completions.push(completion);
                });
            }
        }

        // Header subsection completions
        const currentSection = this.getCurrentSection(document, position);
        if (currentSection === 'header') {
            completions.push(
                this.createSubsectionCompletion('assignment', 'Assignment details'),
                this.createSubsectionCompletion('student', 'Student name'),
                this.createSubsectionCompletion('date', 'Date of submission'),
                this.createSubsectionCompletion('collaborators', 'Collaborators (if any)'),
                this.createSubsectionCompletion('problem', 'Problem description')
            );
        }

        // Subsection completions based on context
        if (currentSection === 'blueprint') {
            completions.push(
                this.createSubsectionCompletion('requires', 'Requirements specification'),
                this.createSubsectionCompletion('ensures', 'Ensures specification')
            );
        } else if (currentSection === 'induction') {
            completions.push(
                this.createSubsectionCompletion('base case', 'Base case of induction'),
                this.createSubsectionCompletion('induction hypothesis', 'Induction hypothesis'),
                this.createSubsectionCompletion('inductive step', 'Inductive step')
            );
        } else if (currentSection === 'invariant') {
            completions.push(
                this.createSubsectionCompletion('pre-condition', 'Pre-condition'),
                this.createSubsectionCompletion('after the ith step', 'After the ith step'),
                this.createSubsectionCompletion('after the after the (i+1)th stepth step', 'After the after the (i+1)th stepth step'),
                this.createSubsectionCompletion('post-condition', 'Post-condition')
            );
        }

        return completions;
    }

    private createSectionCompletion(section: string, description: string): vscode.CompletionItem {
        const completion = new vscode.CompletionItem(section, vscode.CompletionItemKind.Keyword);
        completion.detail = description;
        completion.insertText = new vscode.SnippetString(`${section}\n$0\n${section}>>`);
        return completion;
    }

    private createSubsectionCompletion(subsection: string, description: string): vscode.CompletionItem {
        const completion = new vscode.CompletionItem(subsection, vscode.CompletionItemKind.Keyword);
        completion.detail = description;
        completion.insertText = new vscode.SnippetString(`${subsection}:\n$0`);
        return completion;
    }

    private getCurrentSection(document: vscode.TextDocument, position: vscode.Position): string | null {
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text.trim();
            const match = line.match(/^<<(blueprint|operational steps|ocaml code|proof|induction|invariant|header)$/);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    private isInOperationalSteps(document: vscode.TextDocument, lineNumber: number): boolean {
        let inOperationalSteps = false;

        for (let i = 0; i <= lineNumber; i++) {
            const line = document.lineAt(i).text.trim();

            if (line === '<<operational steps') {
                inOperationalSteps = true;
            } else if (line === 'operational steps>>') {
                inOperationalSteps = false;
            }
        }

        return inOperationalSteps;
    }

    private getStepReferences(document: vscode.TextDocument): Array<{ number: number, text: string, line: number }> {
        const steps: Array<{ number: number, text: string, line: number }> = [];
        let inOperationalSteps = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();

            if (line === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }

            if (inOperationalSteps && line === 'operational steps>>') {
                inOperationalSteps = false;
                continue;
            }

            if (inOperationalSteps) {
                // Updated regex to handle both 'step n:' and 'n.' formats
                const stepMatch = line.match(/^\s*(?:step\s+)?(\d+)\s*[.:]?\s*(.+)$/i);
                if (stepMatch) {
                    steps.push({
                        number: parseInt(stepMatch[1]),
                        text: stepMatch[2],
                        line: i
                    });
                }
            }
        }

        return steps;
    }
}

class ICSHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position, /step \d+/);
        if (!range) return;

        const word = document.getText(range);
        const stepMatch = word.match(/step (\d+)/);
        if (!stepMatch) return;

        const stepNumber = parseInt(stepMatch[1]);
        const stepInfo = this.findStepInfo(document, stepNumber);

        if (stepInfo) {
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Step ${stepNumber}**: ${stepInfo.text}`);
            markdown.appendMarkdown(`\n\n*Click to go to definition*`);
            return new vscode.Hover(markdown, range);
        }
    }

    private findStepInfo(document: vscode.TextDocument, stepNumber: number): { text: string, line: number } | null {
        let inOperationalSteps = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();

            if (line === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }

            if (inOperationalSteps && line === 'operational steps>>') {
                break;
            }

            if (inOperationalSteps) {
                const stepMatch = line.match(/^\s*(?:step\s+)?(\d+)\s*[.:]?\s*(.+)$/i);
                if (stepMatch && parseInt(stepMatch[1]) === stepNumber) {
                    return { text: stepMatch[2], line: i };
                }
            }
        }

        return null;
    }
}

class ICSDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Definition> {
        const range = document.getWordRangeAtPosition(position, /step \d+/);
        if (!range) return;

        const word = document.getText(range);
        const stepMatch = word.match(/step (\d+)/);
        if (!stepMatch) return;

        const stepNumber = parseInt(stepMatch[1]);
        const stepInfo = this.findStepDefinition(document, stepNumber);

        if (stepInfo) {
            return new vscode.Location(
                document.uri,
                new vscode.Position(stepInfo.line, 0)
            );
        }
    }

    private findStepDefinition(document: vscode.TextDocument, stepNumber: number): { line: number } | null {
        let inOperationalSteps = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();

            if (line === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }

            if (inOperationalSteps && line === 'operational steps>>') {
                break;
            }

            if (inOperationalSteps) {
                const stepMatch = line.match(/^\s*(?:step\s+)?(\d+)\s*[.:]?\s*(.+)$/i);
                if (stepMatch && parseInt(stepMatch[1]) === stepNumber) {
                    return { line: i };
                }
            }
        }

        return null;
    }
}