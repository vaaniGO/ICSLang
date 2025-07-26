import React, { useState } from 'react';
import { Plus, Trash2, Save, Download } from 'lucide-react';

const AssignmentForm = () => {
    const [assignmentNumber, setAssignmentNumber] = useState('');
    const [problems, setProblems] = useState([]);

    const addProblem = () => {
        const newProblem = {
            id: Date.now(),
            number: '',
            selectedFields: {
                blueprint: false,
                operationalSteps: false,
                ocamlCode: false,
                proof: false,
                textAnswer: false
            },
            blueprintOptions: {
                functionalCorrectness: false,
                complexity: false,
                inputOutput: false
            },
            ocamlFlags: []
        };
        setProblems([...problems, newProblem]);
    };

    const removeProblem = (id) => {
        setProblems(problems.filter(problem => problem.id !== id));
    };

    const updateProblem = (id, field, value) => {
        setProblems(problems.map(problem =>
            problem.id === id ? { ...problem, [field]: value } : problem
        ));
    };

    const updateSelectedFields = (id, field, checked) => {
        setProblems(problems.map(problem =>
            problem.id === id
                ? {
                    ...problem,
                    selectedFields: { ...problem.selectedFields, [field]: checked },
                    // Reset blueprint options if blueprint is unchecked
                    blueprintOptions: field === 'blueprint' && !checked
                        ? { functionalCorrectness: false, complexity: false, inputOutput: false }
                        : problem.blueprintOptions
                }
                : problem
        ));
    };

    const updateBlueprintOptions = (id, option, checked) => {
        setProblems(problems.map(problem =>
            problem.id === id
                ? {
                    ...problem,
                    blueprintOptions: { ...problem.blueprintOptions, [option]: checked }
                }
                : problem
        ));
    };

    const updateOcamlFlags = (id, flag, checked) => {
        setProblems(problems.map(problem => {
            if (problem.id === id) {
                const newFlags = checked
                    ? [...problem.ocamlFlags, flag]
                    : problem.ocamlFlags.filter(f => f !== flag);
                return { ...problem, ocamlFlags: newFlags };
            }
            return problem;
        }));
    };

    const validateForm = () => {
        if (!assignmentNumber.trim()) {
            alert('Please enter assignment number');
            return false;
        }

        if (problems.length === 0) {
            alert('Please add at least one problem');
            return false;
        }

        for (const problem of problems) {
            if (!problem.number.trim()) {
                alert(`Please enter problem number for all problems`);
                return false;
            }

            const hasSelectedField = Object.values(problem.selectedFields).some(Boolean);
            if (!hasSelectedField) {
                alert(`Problem ${problem.number}: Please select at least one field type`);
                return false;
            }

            if (problem.selectedFields.blueprint) {
                const hasBlueprintOption = Object.values(problem.blueprintOptions).some(Boolean);
                if (!hasBlueprintOption) {
                    alert(`Problem ${problem.number}: Please select at least one blueprint option`);
                    return false;
                }
            }
        }

        return true;
    };

    const generateJSON = () => {
        if (!validateForm()) return null;

        const jsonData = {
            Problems: problems.map(problem => {
                const problemObj = {
                    Number: problem.number
                };

                if (problem.selectedFields.blueprint) {
                    const blueprintArray = [];
                    if (problem.blueprintOptions.functionalCorrectness) blueprintArray.push('FunctionalCorrectness');
                    if (problem.blueprintOptions.complexity) blueprintArray.push('Complexity');
                    if (problem.blueprintOptions.inputOutput) blueprintArray.push('Input-Output');
                    problemObj.Blueprint = blueprintArray;
                }

                if (problem.selectedFields.operationalSteps) {
                    problemObj['Operational Steps'] = null;
                }

                if (problem.selectedFields.ocamlCode) {
                    problemObj['Ocaml Code'] = problem.ocamlFlags.length > 0 ? problem.ocamlFlags : null;
                }

                if (problem.selectedFields.proof) {
                    problemObj.Proof = null;
                }

                if (problem.selectedFields.textAnswer) {
                    problemObj['Text Answer'] = null;
                }

                return problemObj;
            })
        };

        return jsonData;
    };

    const saveAssignment = async () => {
        const jsonData = generateJSON();
        if (!jsonData) return;

        try {
            // Create filename
            const filename = `assignment_${assignmentNumber.replace(/\s+/g, '_')}.json`;
            const jsonString = JSON.stringify(jsonData, null, 4);

            // Create a blob and download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`Assignment instructions saved as ${filename}. Please move this file to ../src/ directory manually.`);
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file. Please try again.');
        }
    };

    const previewJSON = () => {
        const jsonData = generateJSON();
        if (jsonData) {
            console.log('Generated JSON:', jsonData);
            alert('JSON generated successfully! Check the browser console for preview.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Assignment JSON Generator</h1>

                {/* Assignment Number Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assignment Number *
                    </label>
                    <input
                        type="text"
                        value={assignmentNumber}
                        onChange={(e) => setAssignmentNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter assignment number (e.g., Assignment 1)"
                    />
                </div>

                {/* Add Problem Button */}
                <button
                    onClick={addProblem}
                    className="mb-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Problem
                </button>
            </div>

            {/* Problems List */}
            <div className="space-y-6">
                {problems.map((problem, index) => (
                    <div key={problem.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Problem {index + 1}</h3>
                            <button
                                onClick={() => removeProblem(problem.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Problem Number */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Problem Number *
                            </label>
                            <input
                                type="text"
                                value={problem.number}
                                onChange={(e) => updateProblem(problem.id, 'number', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., 1, 2-a, 3-b"
                            />
                        </div>

                        {/* Field Type Checkboxes */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Field Types * (select at least one)
                            </label>
                            <div className="space-y-3">
                                {/* Blueprint */}
                                <div>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={problem.selectedFields.blueprint}
                                            onChange={(e) => updateSelectedFields(problem.id, 'blueprint', e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Blueprint</span>
                                    </label>

                                    {/* Blueprint Options */}
                                    {problem.selectedFields.blueprint && (
                                        <div className="ml-6 mt-2 space-y-2">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={problem.blueprintOptions.functionalCorrectness}
                                                    onChange={(e) => updateBlueprintOptions(problem.id, 'functionalCorrectness', e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-600">Functional Correctness</span>
                                            </label>
                                            <label className="inline-flex items-center block">
                                                <input
                                                    type="checkbox"
                                                    checked={problem.blueprintOptions.complexity}
                                                    onChange={(e) => updateBlueprintOptions(problem.id, 'complexity', e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-600">Complexity</span>
                                            </label>
                                            <label className="inline-flex items-center block">
                                                <input
                                                    type="checkbox"
                                                    checked={problem.blueprintOptions.inputOutput}
                                                    onChange={(e) => updateBlueprintOptions(problem.id, 'inputOutput', e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-600">Input-Output</span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Other Field Types */}
                                <label className="inline-flex items-center block">
                                    <input
                                        type="checkbox"
                                        checked={problem.selectedFields.operationalSteps}
                                        onChange={(e) => updateSelectedFields(problem.id, 'operationalSteps', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Operational Steps</span>
                                </label>

                                <div>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={problem.selectedFields.ocamlCode}
                                            onChange={(e) => updateSelectedFields(problem.id, 'ocamlCode', e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">OCaml Code</span>
                                    </label>

                                    {/* OCaml Flags */}
                                    {problem.selectedFields.ocamlCode && (
                                        <div className="ml-6 mt-2 space-y-2">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={problem.ocamlFlags.includes('-allow-for-loop')}
                                                    onChange={(e) => updateOcamlFlags(problem.id, '-allow-for-loop', e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-600">-allow-for-loop</span>
                                            </label>
                                            <label className="inline-flex items-center block">
                                                <input
                                                    type="checkbox"
                                                    checked={problem.ocamlFlags.includes('-allow-mutability')}
                                                    onChange={(e) => updateOcamlFlags(problem.id, '-allow-mutability', e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-600">-allow-mutability</span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <label className="inline-flex items-center block">
                                    <input
                                        type="checkbox"
                                        checked={problem.selectedFields.proof}
                                        onChange={(e) => updateSelectedFields(problem.id, 'proof', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Proof</span>
                                </label>

                                <label className="inline-flex items-center block">
                                    <input
                                        type="checkbox"
                                        checked={problem.selectedFields.textAnswer}
                                        onChange={(e) => updateSelectedFields(problem.id, 'textAnswer', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Text Answer</span>
                                </label>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            {problems.length > 0 && (
                <div className="mt-8 flex space-x-4">
                    <button
                        onClick={previewJSON}
                        className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Preview JSON
                    </button>
                    <button
                        onClick={saveAssignment}
                        className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Generate and Save Assignment Instructions
                    </button>
                </div>
            )}

            {problems.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <p>No problems added yet. Click "Add Problem" to get started.</p>
                </div>
            )}
        </div>
    );
};

export default AssignmentForm;