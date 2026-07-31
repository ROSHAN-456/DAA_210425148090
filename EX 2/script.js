document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('run-btn');
    const textInput = document.getElementById('text-input');
    const patternInput = document.getElementById('pattern-input');
    const resultsContainer = document.getElementById('results-container');
    const tableContainer = document.getElementById('table-container');
    const tableBody = document.getElementById('table-body');

    runBtn.addEventListener('click', () => {
        const text = textInput.value;
        const pattern = patternInput.value;

        if (!text || !pattern) {
            alert("Please enter both text and a pattern.");
            return;
        }

        // Run Algorithms
        const naiveRes = naiveSearch(text, pattern);
        const rkRes = rabinKarpSearch(text, pattern);
        const kmpRes = kmpSearch(text, pattern);

        // Update UI
        updateCard('card-naive', naiveRes);
        updateCard('card-rk', rkRes);
        updateCard('card-kmp', kmpRes);

        updateTable([
            { name: 'Naive', worstCase: 'O(m * n)', res: naiveRes },
            { name: 'Rabin-Karp', worstCase: 'O(m * n)', res: rkRes },
            { name: 'KMP', worstCase: 'O(n)', res: kmpRes }
        ]);

        // Reveal sections with a neon flash
        resultsContainer.classList.remove('hidden');
        tableContainer.classList.remove('hidden');
        
        // Trigger pulse animation
        document.querySelectorAll('.card').forEach(card => {
            card.classList.remove('pulse-animate');
            void card.offsetWidth; // Trigger reflow to restart animation
            card.classList.add('pulse-animate');
        });
    });

    function updateCard(cardId, data) {
        const card = document.getElementById(cardId);
        const matchSpan = card.querySelector('.matches');
        const compSpan = card.querySelector('.comparisons');
        
        matchSpan.textContent = data.matches.length > 0 ? data.matches.join(', ') : 'None';
        compSpan.textContent = data.comparisons;
    }

    function updateTable(algoData) {
        tableBody.innerHTML = '';
        algoData.forEach(algo => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${algo.name}</strong></td>
                <td>${algo.worstCase}</td>
                <td style="color: var(--neon-blue); font-weight: bold;">${algo.res.comparisons}</td>
                <td>${algo.res.matches.length}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // --- ALGORITHMS ---

    // 1. Naive Search
    function naiveSearch(text, pattern) {
        let comparisons = 0;
        let matches = [];
        let n = text.length;
        let m = pattern.length;

        for (let i = 0; i <= n - m; i++) {
            let j;
            for (j = 0; j < m; j++) {
                comparisons++;
                if (text[i + j] !== pattern[j]) break;
            }
            if (j === m) matches.push(i);
        }
        return { matches, comparisons };
    }

    // 2. Rabin-Karp Search
    function rabinKarpSearch(text, pattern) {
        let comparisons = 0;
        let matches = [];
        let n = text.length;
        let m = pattern.length;
        
        if (m === 0 || m > n) return { matches, comparisons };

        const d = 256; // Number of characters in the input alphabet
        const q = 101; // A prime number
        let h = 1;
        let p = 0; // hash value for pattern
        let t = 0; // hash value for text

        for (let i = 0; i < m - 1; i++) h = (h * d) % q;

        for (let i = 0; i < m; i++) {
            p = (d * p + pattern.charCodeAt(i)) % q;
            t = (d * t + text.charCodeAt(i)) % q;
        }

        for (let i = 0; i <= n - m; i++) {
            if (p === t) {
                let j;
                for (j = 0; j < m; j++) {
                    comparisons++; // Count actual character comparisons inside a hash match
                    if (text[i + j] !== pattern[j]) break;
                }
                if (j === m) matches.push(i);
            }
            if (i < n - m) {
                t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
                if (t < 0) t = (t + q);
            }
        }
        return { matches, comparisons };
    }

    // 3. Knuth-Morris-Pratt (KMP) Search
    function kmpSearch(text, pattern) {
        let comparisons = 0;
        let matches = [];
        let n = text.length;
        let m = pattern.length;
        
        if (m === 0) return { matches, comparisons };

        // Compute LPS (Longest Prefix Suffix) Array
        let lps = new Array(m).fill(0);
        let len = 0;
        let i = 1;
        
        while (i < m) {
            comparisons++; // Counting comparisons during LPS building
            if (pattern[i] === pattern[len]) {
                len++;
                lps[i] = len;
                i++;
            } else {
                if (len !== 0) {
                    len = lps[len - 1];
                } else {
                    lps[i] = 0;
                    i++;
                }
            }
        }

        // KMP Search
        i = 0; // index for text
        let j = 0; // index for pattern
        while (i < n) {
            comparisons++;
            if (pattern[j] === text[i]) {
                i++;
                j++;
            }
            if (j === m) {
                matches.push(i - j);
                j = lps[j - 1];
            } else if (i < n && pattern[j] !== text[i]) {
                if (j !== 0) {
                    j = lps[j - 1];
                } else {
                    i++;
                }
            }
        }
        return { matches, comparisons };
    }
});