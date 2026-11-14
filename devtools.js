
// ====================
// SECTION 1: DICTIONARY
// ====================

let dictionary = new Set();
let dictionaryLoaded = false;

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

    if (!dictionaryLoaded) {
        result.textContent = "Dictionary is still loading.";
        return;
    }

    const targetWord = normalizeWord(input.value);

    if (targetWord === "") {
        result.textContent = "Please enter a valid target word.";
        return;
    }

   

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
// SECTION 4: EQUIVALENCE FINDER
// ====================


function equivFinder() {
    const result = document.getElementById("equivFinderResult");
    const input = document.getElementById("equivFinderInput");

    if (!dictionaryLoaded) {
        result.textContent = "Dictionary is still loading.";
        return;
    }

    const word = normalizeWord(input.value);

    if (word === "") {
        result.textContent = "Please enter at least one letter.";
        return;
    }

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

    // Display matching words with their lengths.
    const wordList = matches
        .map(word => `${word} (${word.length})`)
        .join("\n");

    // Count solutions of each length.
    const lengthCounts = new Map();

    for (const word of matches) {
        lengthCounts.set(
            word.length,
            (lengthCounts.get(word.length) || 0) + 1
        );
    }

    const total = matches.length;

    const summary = [
        `Total solutions: ${total}`,
        "",
        "Solutions by length:",
        ...[...lengthCounts.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([length, count]) => `${length} letters: ${count}`)
    ].join("\n");

    result.textContent =
        wordList + "\n\n" + summary;
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
