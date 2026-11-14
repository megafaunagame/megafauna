
// ====================
// SECTION 1: DICTIONARY
// ====================

let dictionary = new Set();
let dictionaryLoaded = false;
let randomTarget = "";
let randomMask = 0;
let randomPlayedWords = [];
let randomPuzzleSolved = false;
let autoNewPuzzlePending = false;

function normalizeWord(word) {
    return word
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z]/g, "");
}

// Load the dictionary.
fetch("words_enable.txt")
    .then(response => {
        if (!response.ok) {
            throw new Error("Dictionary could not be loaded.");
        }
        return response.text();
    })
    .then(dictionaryText => {
        const words = dictionaryText
            .split(/\r?\n/)
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 0);

        dictionary = new Set(words);
        dictionaryLoaded = true;

        document.getElementById("dictionaryStatus").textContent =
            `Dictionary loaded: ${dictionary.size} words.`;

        console.log("Dictionary loaded:", dictionary.size, "words.");
    })
    .catch(error => {
        document.getElementById("dictionaryStatus").textContent =
            "Error loading dictionary. Check that words_enable.txt exists.";

        console.error(error);
    });


// ====================
// SECTION 2: WORD / MASK UTILITIES
// ====================

function wordToMask(word) {
    let mask = 0;

    for (const letter of word.toLowerCase()) {
        const index = letter.charCodeAt(0) - 97;

        if (index >= 0 && index < 26) {
            mask ^= (1 << index);
        }
    }

    return mask;
}
function maskToLetters(mask) {
    let result = "";

    for (let i = 0; i < 26; i++) {
        if (mask & (1 << i)) {
            result += String.fromCharCode(97 + i).toUpperCase();
        }
    }

    return result || "—";
}


// ====================
// SECTION 3: SOLVER
// ====================

let solverMoves = new Map();
let solverReady = false;

function buildSolverDictionary(targetWord) {
    solverMoves = new Map();

    for (const word of dictionary) {
        if (word === targetWord) {
            continue;
        }

        const mask = wordToMask(word);

        if (mask === 0) {
            continue;
        }

        if (!solverMoves.has(mask)) {
            solverMoves.set(mask, word);
        }
    }

    solverReady = true;

    console.log("Unique solver masks:", solverMoves.size);
}

function solveDevtoolsPuzzle() {
    const result = document.getElementById("solverResult");
    const input = document.getElementById("solverInput");
    result.replaceChildren();

    if (!dictionaryLoaded) {
        result.textContent = "Dictionary is still loading.";
        return;
    }

    const targetWord = normalizeWord(input.value);


   

    const currentMask = wordToMask(targetWord);

    

    // Rebuild the solver dictionary for this target.
    // This excludes the target word itself.
    buildSolverDictionary(targetWord);

    const start = performance.now();
    const solution = bidirectionalBFS(currentMask, 0);
    const time = performance.now() - start;

    if (solution === null) {
        result.textContent = "No solution found.";
        return;
    }

    result.textContent =
        "Solution (" + solution.length + " words): " +
        solution.join(" → ") +
        " | " + time.toFixed(1) + " ms";

    console.log("Solver time:", time.toFixed(1), "ms");
    console.log("Solution:", solution);
}

function bidirectionalBFS(start, goal) {
    const moves = [...solverMoves.entries()];

    const startParent = new Map();
    const goalParent = new Map();

    const startMove = new Map();
    const goalMove = new Map();

    startParent.set(start, null);
    goalParent.set(goal, null);

    let startFrontier = [start];
    let goalFrontier = [goal];

    while (startFrontier.length > 0 && goalFrontier.length > 0) {
        const startResult = expandFrontier(
            startFrontier,
            startParent,
            startMove,
            goalParent,
            moves
        );

        if (startResult.meeting !== null) {
            return reconstructSolution(
                startResult.meeting,
                startParent,
                startMove,
                goalParent,
                goalMove
            );
        }

        startFrontier = startResult.nextFrontier;

        const goalResult = expandFrontier(
            goalFrontier,
            goalParent,
            goalMove,
            startParent,
            moves
        );

        if (goalResult.meeting !== null) {
            return reconstructSolution(
                goalResult.meeting,
                startParent,
                startMove,
                goalParent,
                goalMove
            );
        }

        goalFrontier = goalResult.nextFrontier;
    }

    return null;
}

function expandFrontier(
    frontier,
    parent,
    moveUsed,
    otherParent,
    moves
) {
    const nextFrontier = [];

    for (const state of frontier) {
        for (const [mask, word] of moves) {
            const next = state ^ mask;

            if (parent.has(next)) {
                continue;
            }

            parent.set(next, state);
            moveUsed.set(next, word);

            if (otherParent.has(next)) {
                return {
                    nextFrontier: [],
                    meeting: next
                };
            }

            nextFrontier.push(next);
        }
    }

    return {
        nextFrontier: nextFrontier,
        meeting: null
    };
}

function reconstructSolution(
    meeting,
    startParent,
    startMove,
    goalParent,
    goalMove
) {
    const firstHalf = [];
    let state = meeting;

    while (startParent.get(state) !== null) {
        firstHalf.push(startMove.get(state));
        state = startParent.get(state);
    }

    firstHalf.reverse();

    const secondHalf = [];
    state = meeting;

    while (goalParent.get(state) !== null) {
        secondHalf.push(goalMove.get(state));
        state = goalParent.get(state);
    }

    return firstHalf.concat(secondHalf);
}


// ====================
// SECTION 4: RANDOM PUZZLE
// ====================

function newRandomPuzzle() {
    if (!dictionaryLoaded) {
        document.getElementById("randomMessage").textContent =
            "Dictionary is still loading.";
        return;
    }
    autoNewPuzzlePending = false;

    const candidates = [...dictionary].filter(
        word => wordToMask(word) !== 0
    );

    if (candidates.length === 0) {
        document.getElementById("randomMessage").textContent =
            "No suitable words are available.";
        return;
    }

    randomTarget =
        candidates[Math.floor(Math.random() * candidates.length)];

    randomMask = wordToMask(randomTarget);
    randomPlayedWords = [];
    randomPuzzleSolved = false;

    document.getElementById("randomTarget").textContent =
        randomTarget.toUpperCase();

    const remainingElement = document.getElementById("randomRemaining");

    remainingElement.textContent = maskToLetters(randomMask);
    remainingElement.style.display =
        document.getElementById("showRemaining").checked
            ? "inline"
            : "none";

    document.getElementById("randomWordList").replaceChildren();

    document.getElementById("randomMessage").textContent = "";

    document.getElementById("randomWordInput").value = "";
    document.getElementById("randomWordInput").disabled = false;

    document.getElementById("randomPuzzleArea").style.display = "block";

    document.getElementById("randomWordInput").focus();
}


function addRandomWord() {
    const message = document.getElementById("randomMessage");
    const input = document.getElementById("randomWordInput");

    if (randomPuzzleSolved) {
        return;
    }

    if (!dictionaryLoaded) {
        message.textContent = "Dictionary is still loading.";
        return;
    }

    const word = input.value.trim().toLowerCase();

    if (word === "") {
        return;
    }

    if (!dictionary.has(word)) {
        message.textContent = "Not in dictionary.";
        return;
    }

    if (word === randomTarget) {
        message.textContent = "You cannot use the target word.";
        return;
    }

    randomMask ^= wordToMask(word);
    randomPlayedWords.push(word);

    const listItem = document.createElement("li");
    listItem.textContent = word;
    document.getElementById("randomWordList").appendChild(listItem);

    input.value = "";
    input.focus();

    document.getElementById("randomRemaining").textContent =
        maskToLetters(randomMask);

        if (randomMask === 0) {
    randomPuzzleSolved = true;

    message.textContent =
        `Solved! You used ${randomPlayedWords.length} word(s).`;

    if (document.getElementById("autoNewPuzzle").checked) {
        autoNewPuzzlePending = true;
        input.disabled = false;
    } else {
        input.disabled = true;
    }
} else {        message.textContent = "";
    }
}



// ====================
// SECTION 4: EQUIVALENCE FINDER
// ====================



function equivFinder() {
    const result = document.getElementById("equivFinderResult");
    const input = document.getElementById("equivFinderInput");

    result.replaceChildren();
    
    if (!dictionaryLoaded) {
        result.textContent = "Dictionary is still loading.";
        return;
    }

    const word = normalizeWord(input.value);

    const mask = wordToMask(word);
    const sortBy = document.getElementById("equivFinderSort").value;

    const matches = [...dictionary]
        .filter(word => wordToMask(word) === mask);

    if (sortBy === "length") {
        matches.sort((a, b) =>
            a.length - b.length || a.localeCompare(b)
        );
    } else {
        matches.sort((a, b) => a.localeCompare(b));
    }

    // Show the solution lengths breakdown only when requested.
if (document.getElementById("showSolutionLengths").checked) {
    const lengthCounts = new Map();

    for (const word of matches) {
        lengthCounts.set(
            word.length,
            (lengthCounts.get(word.length) || 0) + 1
        );
    }

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.marginBottom = "20px";

    function addRow(label, count) {
        const row = document.createElement("tr");

        const labelCell = document.createElement("td");
        labelCell.textContent = label;

        const countCell = document.createElement("td");
        countCell.textContent = count;

        for (const cell of [labelCell, countCell]) {
            cell.style.border = "1px solid #ccc";
            cell.style.padding = "6px 12px";
        }

        row.append(labelCell, countCell);
        table.appendChild(row);
    }

    addRow("Total solutions", matches.length);

    for (const [length, count] of [...lengthCounts.entries()]
        .sort((a, b) => a[0] - b[0])) {

        addRow(`${length} letters`, count);
    }

    result.appendChild(table);
}
    // Display the full list of matching words.
    

    const wordList = document.createElement("div");
    wordList.style.whiteSpace = "pre-wrap";

    wordList.textContent = matches
        .map(word => `${word} (${word.length})`)
        .join("\n");

    result.appendChild(wordList);
}
function clearSolverInput() {
    document.getElementById("solverInput").value = "";
    document.getElementById("solverResult").replaceChildren();
    document.getElementById("solverInput").focus();
}

function clearEquivFinderInput() {
    document.getElementById("equivFinderInput").value = "";
    document.getElementById("equivFinderResult").replaceChildren();
    document.getElementById("equivFinderInput").focus();
}
// ====================
// SECTION 5: INPUT SETUP
// ====================

document.getElementById("solverInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        solveDevtoolsPuzzle();
    }
});

document.getElementById("equivFinderInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        equivFinder();
    }
});

document.getElementById("randomWordInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        addRandomWord();
    }
});
document.getElementById("showRemaining").addEventListener("change", event => {
    document.getElementById("randomRemaining").style.display =
        event.target.checked ? "inline" : "none";
});
document.getElementById("randomWordInput").addEventListener("input", event => {
    if (!autoNewPuzzlePending || event.target.value.trim() === "") {
        return;
    }

    const typedText = event.target.value;

    newRandomPuzzle();

    event.target.value = typedText;
});
