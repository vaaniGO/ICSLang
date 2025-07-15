import * as vscode from 'vscode';

export class ICSValidator {
    validate(document: vscode.TextDocument): void {
        const diagnostics = this.getDiagnostics(document);

        if (diagnostics.length > 0) {
            const errorMessages = diagnostics.map(d => d.message).join('\n');
            vscode.window.showErrorMessage(`ICS Validation failed:\n${errorMessages}`);
        } else {
            vscode.window.showInformationMessage('ICS document is valid!');
        }
    }

    getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const content = document.getText();
        const lines = content.split('\n');

        // Track sections and their states
        const sectionStates = new Map<string, { opened: boolean, line: number, closed: boolean }>();
        const requiredSubsections = new Map<string, string[]>();
        const foundSubsections = new Map<string, Set<string>>();

        // Define required subsections for each section type
        requiredSubsections.set('blueprint', ['requires', 'ensures']);
        requiredSubsections.set('induction', ['base case', 'induction hypothesis', 'inductive step']);
        requiredSubsections.set('invariant', ['pre-condition', 'after the ith step', 'after the (i+1)th step', 'post-condition']);
        requiredSubsections.set('header', ['assignment', 'student', 'date', 'collaborators']);

        // Track section hierarchy - use a stack to handle nested sections
        const sectionStack: string[] = [];
        let currentProofType: string | null = null;

        // Track header information found outside of header section
        const headerInfoOutsideSection = new Map<string, number>();
        let headerSectionFound = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check for section opening - fixed syntax: <<keyword
            const openSectionMatch = line.match(/^<<(blueprint|operational steps|ocaml code|proof|induction|invariant|header)$/);
            if (openSectionMatch) {
                const sectionName = openSectionMatch[1];

                // Check if section was already opened
                if (sectionStates.has(sectionName) && sectionStates.get(sectionName)!.opened) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(i, 0, i, line.length),
                        `Section '${sectionName}' is already opened at line ${sectionStates.get(sectionName)!.line + 1}`,
                        vscode.DiagnosticSeverity.Error
                    ));
                    continue;
                }

                sectionStates.set(sectionName, { opened: true, line: i, closed: false });
                sectionStack.push(sectionName);

                // Initialize subsection tracking
                if (requiredSubsections.has(sectionName)) {
                    foundSubsections.set(sectionName, new Set());
                }

                // Special handling for proof sections
                if (sectionName === 'induction' || sectionName === 'invariant') {
                    currentProofType = sectionName;
                    foundSubsections.set(sectionName, new Set());
                } else if (sectionName === 'proof') {
                    // For generic proof sections, we don't set currentProofType
                    currentProofType = null;
                } else if (sectionName === 'header') {
                    headerSectionFound = true;
                }

                continue;
            }

            // Check for section closing - fixed syntax: keyword>>
            const closeSectionMatch = line.match(/^(blueprint|operational steps|ocaml code|proof|induction|invariant|header)>>$/);
            if (closeSectionMatch) {
                const sectionName = closeSectionMatch[1];

                // Check if section exists and is opened
                if (!sectionStates.has(sectionName) || !sectionStates.get(sectionName)!.opened) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(i, 0, i, line.length),
                        `Closing tag for '${sectionName}' found but section was never opened`,
                        vscode.DiagnosticSeverity.Error
                    ));
                    continue;
                }

                // Check if we're in the right section context - should be the top of the stack
                const currentSection = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : null;
                if (currentSection !== sectionName) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(i, 0, i, line.length),
                        `Closing tag for '${sectionName}' found but currently in section '${currentSection}'`,
                        vscode.DiagnosticSeverity.Error
                    ));
                    continue;
                }

                // Mark section as closed
                sectionStates.get(sectionName)!.closed = true;

                // Validate required subsections
                this.validateRequiredSubsections(sectionName, foundSubsections.get(sectionName) || new Set(),
                    requiredSubsections.get(sectionName) || [], diagnostics, i);

                // Pop from stack
                sectionStack.pop();

                if (sectionName === 'induction' || sectionName === 'invariant') {
                    currentProofType = null;
                }
                continue;
            }

            // Check for header information outside of header section
            if (!headerSectionFound || (sectionStack.length > 0 && sectionStack[sectionStack.length - 1] !== 'header')) {
                this.checkHeaderInfoOutsideSection(line, i, headerInfoOutsideSection, diagnostics);
            }

            // Check for subsections
            const currentSection = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : null;
            if (currentSection) {
                this.checkSubsections(line, currentSection, currentProofType, foundSubsections, i, diagnostics);
            }

            // Check for step references
            this.validateStepReferences(line, document, i, diagnostics);
        }

        // Check for unclosed sections
        for (const [sectionName, state] of sectionStates) {
            if (state.opened && !state.closed) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(state.line, 0, state.line, lines[state.line].length),
                    `Section '${sectionName}' is not closed`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        // Check if header section exists
        if (!headerSectionFound) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                `Document must contain a header section enclosed in <<header and header>> tags`,
                vscode.DiagnosticSeverity.Error
            ));
        }

        return diagnostics;
    }

    private checkHeaderInfoOutsideSection(
        line: string,
        lineNumber: number,
        headerInfoOutsideSection: Map<string, number>,
        diagnostics: vscode.Diagnostic[]
    ): void {
        const headerFields = ['assignment:', 'student:', 'date:', 'collaborators:', 'problem:'];

        for (const field of headerFields) {
            if (line.toLowerCase().includes(field)) {
                headerInfoOutsideSection.set(field, lineNumber);
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    `Header information '${field}' must be enclosed within <<header and header>> tags`,
                    vscode.DiagnosticSeverity.Error
                ));
                break; // Only report one error per line
            }
        }
    }

    private checkSubsections(
        line: string,
        currentSection: string,
        currentProofType: string | null,
        foundSubsections: Map<string, Set<string>>,
        lineNumber: number,
        diagnostics: vscode.Diagnostic[]
    ): void {
        // Check for blueprint subsections
        if (currentSection === 'blueprint') {
            if (line.toLowerCase().includes('requires:')) {
                foundSubsections.get('blueprint')?.add('requires');
            } else if (line.toLowerCase().includes('ensures:')) {
                foundSubsections.get('blueprint')?.add('ensures');
            }
        }

        // Check for header subsections
        if (currentSection === 'header') {
            if (line.toLowerCase().includes('assignment:')) {
                foundSubsections.get('header')?.add('assignment');
            } else if (line.toLowerCase().includes('student:')) {
                foundSubsections.get('header')?.add('student');
            } else if (line.toLowerCase().includes('date:')) {
                foundSubsections.get('header')?.add('date');
            } else if (line.toLowerCase().includes('collaborators:')) {
                foundSubsections.get('header')?.add('collaborators');
            } else if (line.toLowerCase().includes('problem:')) {
                foundSubsections.get('header')?.add('problem');
            }
        }

        // Check for proof subsections
        if (currentProofType === 'induction') {
            if (line.toLowerCase().includes('base case:')) {
                foundSubsections.get('induction')?.add('base case');
            } else if (line.toLowerCase().includes('induction hypothesis:')) {
                foundSubsections.get('induction')?.add('induction hypothesis');
            } else if (line.toLowerCase().includes('inductive step:')) {
                foundSubsections.get('induction')?.add('inductive step');
            }
        } else if (currentProofType === 'invariant') {
            if (line.toLowerCase().includes('pre-condition:')) {
                foundSubsections.get('invariant')?.add('pre-condition');
            } else if (line.toLowerCase().includes('after the ith step:')) {
                foundSubsections.get('invariant')?.add('after the ith step');
            } else if (line.toLowerCase().includes('after the (i+1)th step:')) {
                foundSubsections.get('invariant')?.add('after the (i+1)th step');
            } else if (line.toLowerCase().includes('post-condition:')) {
                foundSubsections.get('invariant')?.add('post-condition');
            }
        }
    }

    private validateRequiredSubsections(
        sectionName: string,
        foundSubsections: Set<string>,
        requiredSubsections: string[],
        diagnostics: vscode.Diagnostic[],
        lineNumber: number
    ): void {
        const missingSubsections = requiredSubsections.filter(sub => !foundSubsections.has(sub));

        if (missingSubsections.length > 0) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(lineNumber, 0, lineNumber, 10),
                `Section '${sectionName}' is missing required subsections: ${missingSubsections.join(', ')}`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private getAvailableSteps(document: vscode.TextDocument): number[] {
        const steps: number[] = [];
        const content = document.getText();
        const lines = content.split('\n');
        let inOperationalSteps = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }

            if (inOperationalSteps && trimmed === 'operational steps>>') {
                inOperationalSteps = false;
                continue;
            }

            if (inOperationalSteps) {
                // Fixed regex to handle 'step [number]:' format
                const stepMatch = trimmed.match(/^\s*step\s+(\d+)\s*[.:]?\s*/i);
                if (stepMatch) {
                    steps.push(parseInt(stepMatch[1]));
                }
            }
        }

        return steps;
    }

    private validateStepReferences(
        line: string,
        document: vscode.TextDocument,
        lineNumber: number,
        diagnostics: vscode.Diagnostic[]
    ): void {
        const stepReferences = line.match(/step (\d+)/g);
        if (!stepReferences) return;

        const availableSteps = this.getAvailableSteps(document);

        for (const stepRef of stepReferences) {
            const stepMatch = stepRef.match(/step (\d+)/);
            if (stepMatch) {
                const stepNumber = parseInt(stepMatch[1]);
                if (!availableSteps.includes(stepNumber)) {
                    const startChar = line.indexOf(stepRef);
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(lineNumber, startChar, lineNumber, startChar + stepRef.length),
                        `Step ${stepNumber} is referenced but not defined in operational steps`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    // Method to provide syntax highlighting tokens
    provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
        const tokensBuilder = new vscode.SemanticTokensBuilder();
        const content = document.getText();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Check for section headers
            if (trimmed.match(/^<<blueprint$/) || trimmed.match(/^blueprint>>$/)) {
                tokensBuilder.push(
                    new vscode.Range(i, 0, i, line.length),
                    'keyword',
                    ['blue']
                );
            } else if (trimmed.match(/^<<operational steps$/) || trimmed.match(/^operational steps>>$/)) {
                tokensBuilder.push(
                    new vscode.Range(i, 0, i, line.length),
                    'keyword',
                    ['purple']
                );
            } else if (trimmed.match(/^<<ocaml code$/) || trimmed.match(/^ocaml code>>$/)) {
                tokensBuilder.push(
                    new vscode.Range(i, 0, i, line.length),
                    'keyword',
                    ['orange']
                );
            } else if (trimmed.match(/^<<(proof|induction|invariant)$/) || trimmed.match(/^(proof|induction|invariant)>>$/)) {
                tokensBuilder.push(
                    new vscode.Range(i, 0, i, line.length),
                    'keyword',
                    ['green']
                );
            } else if (trimmed.match(/^<<header$/) || trimmed.match(/^header>>$/)) {
                tokensBuilder.push(
                    new vscode.Range(i, 0, i, line.length),
                    'keyword',
                    ['cyan']
                );
            }
        }

        return tokensBuilder.build();
    }
}