class FlashcardApp {
    constructor() {
        this.allVocabulary = [];
        this.filteredVocabulary = [];
        this.currentIndex = 0;
        this.isFlipped = false;
        this.selectedGrammar = '';
        this.selectedCategory = '';
        this.direction = 'en-ko'; // 'en-ko' or 'ko-en'
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadCSVFile();
    }
    
    initializeElements() {
        this.flashcard = document.getElementById('flashcard');
        this.questionEl = document.getElementById('question');
        this.answerEl = document.getElementById('answer');
        this.sourceEl = document.getElementById('source');
        this.showAnswerBtn = document.getElementById('showAnswerBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.navNextBtn = document.getElementById('navNextBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.grammarDropdown = document.getElementById('grammarDropdown');
        this.categoryDropdown = document.getElementById('categoryDropdown');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.csvFileInput = document.getElementById('csvFile');
        this.directionBtn = document.getElementById('directionBtn');
        this.copyAnswerBtn = document.getElementById('copyAnswerBtn');
        this.pronounceBtn = document.getElementById('pronounceBtn');
        this.synth = window.speechSynthesis;
        
        // Store selected voices for reference
        this.selectedVoices = {
            'ko-KR': null,
            'en-US': null
        };
    }
    
    attachEventListeners() {
        this.showAnswerBtn.addEventListener('click', () => this.toggleAnswer());
        this.prevBtn.addEventListener('click', () => this.previousCard());
        this.navNextBtn.addEventListener('click', () => this.nextCard());
        this.nextBtn.addEventListener('click', () => this.resetDeck());
        this.uploadBtn.addEventListener('click', () => this.csvFileInput.click());
        this.csvFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.flashcard.addEventListener('click', (e) => {
            // Don't flip if user is selecting text
            if (window.getSelection().toString().length === 0) {
                this.toggleAnswer();
            }
        });
        this.directionBtn.addEventListener('click', () => this.toggleDirection());
        this.copyAnswerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyAnswer();
        });
        this.pronounceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.pronounceAnswer();
        });
        // Don't filter automatically - wait for Next button
    }
    
    async loadCSVFile() {
        try {
            const response = await fetch('Korean 20251213.csv');
            if (response.ok) {
                const text = await response.text();
                this.parseCSV(text);
            } else {
                this.showMessage('CSV file not found. Please click "Upload CSV" button to load your vocabulary file.');
            }
        } catch (error) {
            // This happens when opening HTML directly from file system (file:// protocol)
            // Browser security prevents loading local files via fetch
            this.showMessage('Please click "Upload CSV" button to load your vocabulary file. (Tip: For auto-loading, run via a local web server - see README.md)');
        }
    }
    
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this.parseCSV(text);
        };
        reader.readAsText(file);
    }
    
    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        this.allVocabulary = [];
        
        // Skip header row
        const startIndex = 1;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = this.parseCSVLine(line);
            
            if (parts.length >= 6) {
                const no = parts[0].trim();
                const grammar = parts[1].trim();
                const category = parts[2].trim();
                // Preserve exact Korean text from CSV (column 3)
                const korean = parts[3].trim();
                // Preserve exact English text from CSV (column 4)
                const english = parts[4].trim();
                const source = parts[5].trim();
                
                if (korean && english) {
                    this.allVocabulary.push({ 
                        no, 
                        grammar, 
                        category, 
                        korean: korean, // Exact Korean text
                        english: english, // Exact English text
                        source 
                    });
                }
            }
        }
        
        if (this.allVocabulary.length > 0) {
            this.populateDropdowns();
            this.showMessage('Select filters (optional) and press Next to start');
            alert(`Loaded ${this.allVocabulary.length} vocabulary words!`);
        } else {
            alert('No valid vocabulary found in CSV file. Please check the format.');
        }
    }
    
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result;
    }
    
    populateDropdowns() {
        // Get unique Grammar values
        const grammars = [...new Set(this.allVocabulary.map(v => v.grammar).filter(g => g))].sort();
        this.grammarDropdown.innerHTML = '<option value="">Grammar</option>';
        grammars.forEach(grammar => {
            const option = document.createElement('option');
            option.value = grammar;
            option.textContent = grammar;
            this.grammarDropdown.appendChild(option);
        });
        
        // Get unique Category values
        const categories = [...new Set(this.allVocabulary.map(v => v.category).filter(c => c))].sort();
        this.categoryDropdown.innerHTML = '<option value="">Category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            this.categoryDropdown.appendChild(option);
        });
    }
    
    filterVocabulary() {
        this.filteredVocabulary = this.allVocabulary.filter(v => {
            const grammarMatch = !this.selectedGrammar || v.grammar === this.selectedGrammar;
            const categoryMatch = !this.selectedCategory || v.category === this.selectedCategory;
            return grammarMatch && categoryMatch;
        });
        
        if (this.filteredVocabulary.length > 0) {
            this.currentIndex = 0;
            this.resetFlip();
            this.updateCard();
        } else {
            this.showMessage('No vocabulary found for selected filters');
        }
    }
    
    toggleAnswer() {
        if (this.filteredVocabulary.length === 0) return;
        
        this.isFlipped = !this.isFlipped;
        this.flashcard.classList.toggle('flipped', this.isFlipped);
        
        if (this.isFlipped) {
            this.showAnswerBtn.textContent = 'Show Question';
            this.showAnswerBtn.classList.add('showing');
        } else {
            this.showAnswerBtn.textContent = 'Show Answer';
            this.showAnswerBtn.classList.remove('showing');
        }
    }
    
    resetFlip() {
        this.isFlipped = false;
        this.flashcard.classList.remove('flipped');
        this.showAnswerBtn.textContent = 'Show Answer';
        this.showAnswerBtn.classList.remove('showing');
    }
    
    toggleDirection() {
        this.direction = this.direction === 'en-ko' ? 'ko-en' : 'en-ko';
        this.directionBtn.textContent = this.direction === 'en-ko' ? 'EN → KO' : 'KO → EN';
        
        if (this.filteredVocabulary.length > 0) {
            this.updateCard();
        }
    }
    
    updateCard() {
        if (this.filteredVocabulary.length === 0) {
            this.questionEl.textContent = 'Select filters (optional) and press Next to start';
            this.answerEl.textContent = '';
            this.sourceEl.textContent = '';
            return;
        }
        
        const card = this.filteredVocabulary[this.currentIndex];
        
        // Extract English text (may contain Chinese characters)
        // Get the last meaningful word/phrase from English field
        const englishParts = card.english.trim().split(/\s+/);
        const englishText = englishParts.length > 0 ? englishParts[englishParts.length - 1] : card.english.trim();
        
        if (this.direction === 'en-ko') {
            // English to Korean - show exact Korean text from database
            this.questionEl.textContent = `What is the Korean word for '${englishText}'?`;
            this.answerEl.textContent = card.korean.trim(); // Exact Korean text from database
        } else {
            // Korean to English - show exact English text from database
            this.questionEl.textContent = `What is the English word for '${card.korean.trim()}'?`;
            this.answerEl.textContent = card.english.trim(); // Exact English text from database
        }
        
        this.sourceEl.textContent = `Source: ${card.source}`;
        
        this.resetFlip();
        this.updateNavigationButtons();
    }
    
    showMessage(message) {
        this.questionEl.textContent = message;
        this.answerEl.textContent = '';
        this.sourceEl.textContent = '';
    }
    
    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateCard();
        }
    }
    
    nextCard() {
        if (this.currentIndex < this.filteredVocabulary.length - 1) {
            this.currentIndex++;
            this.updateCard();
        }
    }
    
    resetDeck() {
        // Get current selections (optional - empty means all)
        this.selectedGrammar = this.grammarDropdown.value;
        this.selectedCategory = this.categoryDropdown.value;
        
        // Filter vocabulary based on selections (if any)
        this.filterVocabulary();
        
        if (this.filteredVocabulary.length === 0) {
            alert('No vocabulary found. Please check your filters or upload a CSV file.');
            return;
        }
        
        // Shuffle the filtered deck
        const shuffled = [...this.filteredVocabulary].sort(() => Math.random() - 0.5);
        this.filteredVocabulary = shuffled;
        this.currentIndex = 0;
        this.updateCard();
    }
    
    updateNavigationButtons() {
        this.prevBtn.disabled = this.currentIndex === 0;
        this.navNextBtn.disabled = this.currentIndex === this.filteredVocabulary.length - 1;
    }
    
    copyAnswer() {
        if (this.filteredVocabulary.length === 0) return;
        
        const card = this.filteredVocabulary[this.currentIndex];
        let textToCopy = '';
        
        if (this.direction === 'en-ko') {
            textToCopy = card.korean.trim();
        } else {
            textToCopy = card.english.trim();
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Visual feedback
            const originalText = this.copyAnswerBtn.innerHTML;
            this.copyAnswerBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            this.copyAnswerBtn.style.color = '#34C759';
            setTimeout(() => {
                this.copyAnswerBtn.innerHTML = originalText;
                this.copyAnswerBtn.style.color = '';
            }, 1000);
        }).catch(err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                const originalText = this.copyAnswerBtn.innerHTML;
                this.copyAnswerBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                this.copyAnswerBtn.style.color = '#34C759';
                setTimeout(() => {
                    this.copyAnswerBtn.innerHTML = originalText;
                    this.copyAnswerBtn.style.color = '';
                }, 1000);
            } catch (err) {
                alert('Failed to copy. Please select and copy manually.');
            }
            document.body.removeChild(textArea);
        });
    }
    
    // Improved voice selection - prioritizes clearer voices
    selectBestVoice(voices, lang) {
        if (!voices || voices.length === 0) return null;
        
        // Filter voices by language
        const langVoices = voices.filter(voice => {
            const voiceLang = voice.lang.toLowerCase();
            if (lang === 'ko-KR') {
                return voiceLang.startsWith('ko') || 
                       voice.name.toLowerCase().includes('korean') ||
                       voice.name.toLowerCase().includes('한국');
            } else {
                return voiceLang.startsWith('en');
            }
        });
        
        if (langVoices.length === 0) return null;
        
        // Score voices based on quality indicators
        const scoredVoices = langVoices.map(voice => {
            let score = 0;
            const name = voice.name.toLowerCase();
            const langCode = voice.lang.toLowerCase();
            
            // Prefer enhanced/premium voices (iOS: "Enhanced", "Premium", "Neural")
            if (name.includes('enhanced') || name.includes('premium') || name.includes('neural')) {
                score += 100;
            }
            
            // Prefer female voices (often clearer for language learning)
            // Common female voice indicators
            if (name.includes('female') || 
                name.includes('samantha') || 
                name.includes('susan') ||
                name.includes('karen') ||
                name.includes('victoria') ||
                name.includes('yuna') || // Korean female
                name.includes('sora') ||  // Korean female
                name.includes('nara')) {  // Korean female
                score += 50;
            }
            
            // Prefer specific high-quality voices (iOS)
            // English voices
            if (lang === 'en-US') {
                if (name.includes('samantha') || name.includes('susan')) score += 30;
                if (name.includes('alex') || name.includes('daniel')) score -= 20; // Often male
            }
            
            // Korean voices
            if (lang === 'ko-KR') {
                if (name.includes('yuna') || name.includes('sora') || name.includes('nara')) {
                    score += 30; // Known good Korean voices
                }
                if (name.includes('younghoon') || name.includes('jinho')) {
                    score -= 20; // Often male
                }
            }
            
            // Prefer voices with correct language code match
            if (lang === 'ko-KR' && langCode.startsWith('ko')) score += 20;
            if (lang === 'en-US' && langCode.startsWith('en')) score += 20;
            
            // Prefer default voices (usually better quality)
            if (voice.default) score += 10;
            
            return { voice, score };
        });
        
        // Sort by score (highest first) and return the best one
        scoredVoices.sort((a, b) => b.score - a.score);
        return scoredVoices[0].voice;
    }
    
    pronounceAnswer() {
        if (this.filteredVocabulary.length === 0) return;
        
        // Check if speech synthesis is available
        if (!('speechSynthesis' in window)) {
            alert('Text-to-speech is not supported in your browser.');
            return;
        }
        
        // Stop any ongoing speech
        this.synth.cancel();
        
        const card = this.filteredVocabulary[this.currentIndex];
        let textToPronounce = '';
        let lang = '';
        
        if (this.direction === 'en-ko') {
            textToPronounce = card.korean.trim();
            lang = 'ko-KR'; // Korean language
        } else {
            // Extract English text (may contain Chinese characters)
            const englishParts = card.english.trim().split(/\s+/);
            textToPronounce = englishParts.length > 0 ? englishParts[englishParts.length - 1] : card.english.trim();
            lang = 'en-US'; // English language
        }
        
        if (!textToPronounce) return;
        
        // Function to speak with voice selection
        const speakWithVoice = () => {
            // Get all available voices
            const voices = this.synth.getVoices();
            
            // Create speech synthesis utterance
            const utterance = new SpeechSynthesisUtterance(textToPronounce);
            utterance.lang = lang;
            utterance.rate = 0.85; // Slightly slower for better clarity
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Select the best available voice
            const bestVoice = this.selectBestVoice(voices, lang);
            if (bestVoice) {
                utterance.voice = bestVoice;
                this.selectedVoices[lang] = bestVoice.name;
                // Log for debugging (can be removed in production)
                if (console && console.log) {
                    console.log(`🔊 Using voice: ${bestVoice.name} (${bestVoice.lang})`);
                }
            } else {
                // Fallback: use default voice for language
                if (console && console.log) {
                    console.log(`⚠️ No specific voice found for ${lang}, using system default`);
                }
            }
            
            // Visual feedback
            this.pronounceBtn.style.opacity = '0.5';
            this.pronounceBtn.style.transform = 'scale(0.95)';
            
            utterance.onend = () => {
                this.pronounceBtn.style.opacity = '';
                this.pronounceBtn.style.transform = '';
            };
            
            utterance.onerror = (event) => {
                this.pronounceBtn.style.opacity = '';
                this.pronounceBtn.style.transform = '';
                console.error('Speech synthesis error:', event.error);
                // Try fallback without specific voice
                if (bestVoice) {
                    const fallbackUtterance = new SpeechSynthesisUtterance(textToPronounce);
                    fallbackUtterance.lang = lang;
                    fallbackUtterance.rate = 0.85;
                    this.synth.speak(fallbackUtterance);
                }
            };
            
            // Speak
            this.synth.speak(utterance);
        };
        
        // Ensure voices are loaded (especially important on iOS)
        const voices = this.synth.getVoices();
        if (voices.length === 0) {
            // Wait for voices to load (iOS Safari loads them asynchronously)
            // Try multiple times with increasing delays
            let attempts = 0;
            const maxAttempts = 5;
            const checkVoices = () => {
                const availableVoices = this.synth.getVoices();
                if (availableVoices.length > 0 || attempts >= maxAttempts) {
                    speakWithVoice();
                } else {
                    attempts++;
                    setTimeout(checkVoices, 200);
                }
            };
            checkVoices();
        } else {
            speakWithVoice();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new FlashcardApp();
    
    // Load voices for speech synthesis (some browsers need this)
    if ('speechSynthesis' in window) {
        // iOS Safari and Chrome load voices asynchronously
        // Trigger voice loading by calling getVoices()
        speechSynthesis.getVoices();
        
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                // Voices loaded - trigger again to ensure they're available
                speechSynthesis.getVoices();
            };
        }
        
        // For iOS Safari, sometimes we need to trigger voice loading manually
        // by creating a temporary utterance
        setTimeout(() => {
            const tempUtterance = new SpeechSynthesisUtterance('');
            tempUtterance.volume = 0;
            speechSynthesis.speak(tempUtterance);
            speechSynthesis.cancel();
        }, 100);
    }
});
