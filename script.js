window.__debugMessageLog = [];

// Variables globales
let qcmData = null;
let currentQuestionIndex = 0;
let selectedAnswers = [];
let questionOrder = []; // Tableau pour gérer l'ordre des questions
let originalOrder = []; // Tableau pour conserver l'ordre original
let errorTracking = {}; // Suivi des erreurs par question
let answersRevealed = false; // État de révélation des réponses
let visitedQuestions = new Set(); // Suivi des questions visitées
let navigatorExpanded = true;
let errorQuestions = [];
let currentErrorIndex = -1;
let prevQuestionBtn, nextQuestionBtn, keyboardHint;
let isRevisionMode = false; // Nouvelle variable pour tracker le mode révision
let originalProgressData = null;
let isInCompletionMode = false; // Nouvelle variable pour tracker le mode bilan
let shuffledOptionsMap = {};
let messageTimeout = null;
let suppressNextErrorTrackingMessage = false;
let ignoreNextCheckboxChange = false;
let persistUserMessage = false; // Ajouté pour gérer les
let lastMessageId = 0;


// Éléments DOM
const questionContainer = document.getElementById('question-container');
const validateBtn = document.getElementById('validate-btn');
const messageContainer = document.getElementById('message-container');
const currentQuestionSpan = document.getElementById('current-question');
const totalQuestionsSpan = document.getElementById('total-questions');
const questionIdSpan = document.getElementById('question-id');
const progressFill = document.getElementById('progress-fill');
const scrollToTopBtn = document.getElementById('scroll-to-top');
const errorNavContainer = document.getElementById('error-nav-container');
const prevErrorBtn = document.getElementById('prev-error-btn');
const nextErrorBtn = document.getElementById('next-error-btn');

// Fonction pour mélanger un tableau (algorithme Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// --- NOUVELLE FONCTION POUR SHUFFLE OPTIONS D'UNE QUESTION ---
function getShuffledOptionIndices(questionIndex) {
    // Si déjà mélangé pour cette question, retourner l'ordre mémorisé
    if (shuffledOptionsMap[questionIndex]) {
        return shuffledOptionsMap[questionIndex];
    }
    // Sinon, générer un nouvel ordre aléatoire pour cette question
    const question = qcmData.qcm[questionIndex];
    const indices = question.options.map((_, idx) => idx);
    const shuffled = shuffleArray(indices);
    shuffledOptionsMap[questionIndex] = shuffled;
    return shuffled;
}

// Lors du reset QCM, du changement d'ordre des questions, etc., il faut réinitialiser la map !
function resetShuffledOptions() {
    shuffledOptionsMap = {};
}

// Fonction pour mélanger les questions
function shuffleQuestions() {
    if (!qcmData || !qcmData.qcm) return;
    
    // Sauvegarder les réponses en cours si on est en milieu de QCM
    const wasInProgress = currentQuestionIndex > 0;
    
    if (wasInProgress) {
        const confirmShuffle = confirm('⚠️ Mélanger les questions va redémarrer le QCM. Continuer ?');
        if (!confirmShuffle) return;
    }
    
    // Créer un nouvel ordre aléatoire
    questionOrder = shuffleArray(originalOrder);
    
    // Redémarrer le QCM
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    resetShuffledOptions(); // <--- AJOUT
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    
    showMessage('🔀 Questions mélangées ! Le QCM a redémarré.', 'info');
    setTimeout(clearMessage, 2000);
}

// Fonction pour remettre l'ordre original
function resetOrder() {
    if (!qcmData || !qcmData.qcm) return;
    
    const wasInProgress = currentQuestionIndex > 0;
    
    if (wasInProgress) {
        const confirmReset = confirm('⚠️ Remettre l\'ordre original va redémarrer le QCM. Continuer ?');
        if (!confirmReset) return;
    }
    
    // Remettre l'ordre original
    questionOrder = [...originalOrder];
    
    // Redémarrer le QCM
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    
    showMessage('↩️ Ordre original restauré ! Le QCM a redémarré.', 'info');
    setTimeout(clearMessage, 2000);
}

// Chargement du fichier JSON
async function loadQCMData() {
    try {
        showMessage('🔄 Chargement des questions...', 'info');
        
        // Option 1: Chargement depuis un fichier JSON externe
        const response = await fetch('qcm_complet_v2.json');
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        qcmData = await response.json();
        
        if (!qcmData || !qcmData.qcm || qcmData.qcm.length === 0) {
            throw new Error('Aucune question trouvée dans le fichier JSON');
        }
        
        clearMessage();
        init();
        
    } catch (error) {
        console.error('Erreur lors du chargement du fichier JSON:', error);
        showFileUploadOption();
    }
}

// Option alternative: Upload de fichier
function showFileUploadOption() {
    // Masquer les éléments de navigation et d'interface
    hideNavigationElements();
    
    questionContainer.innerHTML = `
        <div class="upload-container">
            <div class="upload-icon">📁</div>
            <h3>Chargement des questions</h3>
            <p>Le fichier questions.json n'a pas été trouvé.</p>
            <p>Veuillez sélectionner votre fichier JSON contenant les questions :</p>
            <input type="file" id="jsonFileInput" accept=".json" class="file-input">    
            <button onclick="loadFromFile()" class="upload-btn">Charger les questions</button>
        </div>
    `;
}

// Modification de la fonction hideNavigationElements()
function hideNavigationElements() {
    const elementsToHide = [
        document.querySelector('.shuffle-controls'),
        document.getElementById('question-navigator'),
        document.querySelector('.question-counter'),
        document.querySelector('.progress-bar'),
        document.getElementById('validate-btn'),
        document.getElementById('scroll-to-top'),
        document.getElementById('prev-nav'),
        document.getElementById('next-nav'),
        document.getElementById('keyboard-hint'),
        document.getElementById('error-nav-container') // Ajouter la navigation des erreurs
    ];
    
    elementsToHide.forEach(element => {
        if (element) {
            element.style.display = 'none';
        }
    });
}

// Modification de la fonction showNavigationElements()
function showNavigationElements() {
    const elementsToShow = [
        document.querySelector('.shuffle-controls'),
        document.getElementById('question-navigator'),
        document.querySelector('.question-counter'),
        document.querySelector('.progress-bar'),
        document.getElementById('validate-btn'),
        document.getElementById('scroll-to-top'),
        document.getElementById('prev-nav'),
        document.getElementById('next-nav'),
        document.getElementById('keyboard-hint'),
        document.getElementById('error-nav-container')
    ];
    
    elementsToShow.forEach(element => {
        if (element) {
            element.style.display = '';
        }
    });
    
    // Restaurer l'état du navigateur
    setTimeout(restoreNavigatorState, 0);
    updateSideNavigationButtons();
}

// Chargement depuis un fichier uploadé
function loadFromFile() {
    const fileInput = document.getElementById('jsonFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Veuillez sélectionner un fichier JSON', 'error');
        return;
    }
    
    if (!file.name.endsWith('.json')) {
        showMessage('Veuillez sélectionner un fichier JSON valide', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            qcmData = JSON.parse(e.target.result);
            
            if (!qcmData || !qcmData.qcm || qcmData.qcm.length === 0) {
                throw new Error('Format JSON invalide - propriété "qcm" manquante ou vide');
            }
            
            clearMessage();
            init();
            
        } catch (error) {
            console.error('Erreur lors du parsing JSON:', error);
            showMessage(`Erreur dans le fichier JSON: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        showMessage('Erreur lors de la lecture du fichier', 'error');
    };
    
    reader.readAsText(file);
}

// Initialisation
function init() {
    // Réafficher les éléments de navigation si ils étaient cachés
    showNavigationElements();
    
    // Vérifier s'il y a une progression sauvegardée
    const savedProgress = loadSavedProgress();
    
    if (savedProgress) {
        // Afficher la boîte de dialogue de restauration
        showRestoreDialog(savedProgress);
        return;
    }
    
    // Pas de progression sauvegardée, démarrer normalement
    startFreshInit();
}

// Modification de la fonction createQuestionNavigator()
function createQuestionNavigator() {
    const questionButtonsContainer = document.getElementById('question-buttons');
    questionButtonsContainer.innerHTML = '';
    
    questionOrder.forEach((questionIndex, orderIndex) => {
        const question = qcmData.qcm[questionIndex];
        const button = document.createElement('button');
        button.className = 'question-nav-btn';
        button.textContent = orderIndex + 1;
        button.setAttribute('data-question-index', orderIndex);
        button.setAttribute('title', `Question ${orderIndex + 1}${question.id ? ` (ID: ${question.id})` : ''}`);
        button.onclick = () => goToQuestion(orderIndex);
        
        questionButtonsContainer.appendChild(button);
    });
    
    updateNavigatorDisplay();
    
    // Restaurer l'état du navigateur après création
    setTimeout(restoreNavigatorState, 0);
}

// Mise à jour de l'affichage du navigateur
function updateNavigatorDisplay() {
    const buttons = document.querySelectorAll('.question-nav-btn');
    
    buttons.forEach((button, index) => {
        const questionIndex = questionOrder[index];
        
        // Retirer toutes les classes d'état
        button.classList.remove('current', 'visited', 'error-marked');
        
        // Question actuelle
        if (index === currentQuestionIndex) {
            button.classList.add('current');
        }
        // Question visitée
        else if (visitedQuestions.has(index)) {
            button.classList.add('visited');
        }
        
        // Question marquée comme fausse
        if (errorTracking[questionIndex]) {
            button.classList.add('error-marked');
        }
    });
}

function updateErrorQuestionsList() {
    // Masquer complètement en mode révision
    if (isRevisionMode) {
        errorNavContainer.classList.remove('visible');
        return;
    }
    
    const previousErrorQuestions = [...errorQuestions];
    errorQuestions = Object.keys(errorTracking).map(id => parseInt(id));
    
    // Trouver l'index dans l'ordre des questions affiché
    errorQuestions = errorQuestions
        .map(questionId => questionOrder.indexOf(questionId))
        .filter(index => index !== -1)
        .sort((a, b) => a - b);
    
    // Vérifier s'il faut afficher/masquer le bouton
    const shouldShow = errorQuestions.length > 0;
    const wasVisible = errorNavContainer.classList.contains('visible');
    
    if (shouldShow && !wasVisible) {
        // Fade in
        errorNavContainer.classList.add('visible');
    } else if (!shouldShow && wasVisible) {
        // Fade out
        errorNavContainer.classList.remove('visible');
        currentErrorIndex = -1;
    }
    
    // Bug fix: Mettre à jour l'index actuel correctement
    if (errorQuestions.length > 0) {
        const currentQuestionInErrors = errorQuestions.indexOf(currentQuestionIndex);
        if (currentQuestionInErrors !== -1) {
            currentErrorIndex = currentQuestionInErrors;
        } else {
            // Si la question actuelle n'est pas dans les erreurs, garder l'index valide
            if (currentErrorIndex >= errorQuestions.length) {
                currentErrorIndex = errorQuestions.length - 1;
            } else if (currentErrorIndex < 0) {
                currentErrorIndex = 0;
            }
        }
    }
    
    updateErrorNavigationButtons();
}

// Modifier la fonction goToQuestion() existante en ajoutant la sauvegarde :
function goToQuestion(questionIndex) {
    // Bloquer la navigation seulement en mode bilan (pas en mode révision)
    if (isInCompletionMode) {
        return;
    }
    
    // Vérifier que nous avons des données valides
    if (!qcmData || !qcmData.qcm || !questionOrder || questionOrder.length === 0) {
        return;
    }
    
    const maxIndex = isRevisionMode ? questionOrder.length - 1 : qcmData.qcm.length - 1;
    
    if (questionIndex < 0 || questionIndex > maxIndex) return;
    
    // Marquer la question actuelle comme visitée avant de partir
    visitedQuestions.add(currentQuestionIndex);
    
    // Changer de question
    currentQuestionIndex = questionIndex;
    displayQuestion();
    updateProgress();
    updateNavigatorDisplay();   
    
    // Mettre à jour la navigation des erreurs seulement si on n'est pas en mode révision
    if (!isRevisionMode) {
        updateErrorQuestionsList();
    }
    
    // Sauvegarder la progression seulement si on n'est pas en mode révision
    if (!isRevisionMode) {
        saveProgress();
    }
    
    // Scroll vers le haut pour voir la nouvelle question
    scrollToTop();
}

// Fonction de scroll vers le haut
function scrollToTop() {
    window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
    });
}

// Gestion de l'affichage du bouton scroll to top
function handleScrollToTopVisibility() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    if (scrollY > 300) {
        scrollToTopBtn.classList.add('visible');
    } else {
        scrollToTopBtn.classList.remove('visible');
    }
}

// Fonction pour obtenir la question courante selon l'ordre défini
function getCurrentQuestion() {
    const questionIndex = questionOrder[currentQuestionIndex];
    return qcmData.qcm[questionIndex];
}

// Fonction pour obtenir l'ID de la question courante
function getCurrentQuestionId() {
    const questionIndex = questionOrder[currentQuestionIndex];
    return questionIndex;
}

// --- MODIFICATION PRINCIPALE : RANDOMISER L'ORDRE D'AFFICHAGE DES OPTIONS ---
function displayQuestion() {
    const question = getCurrentQuestion();
    selectedAnswers = [];
    answersRevealed = false;

    // Marquer la question comme visitée
    visitedQuestions.add(currentQuestionIndex);

    let html = '';

    // Image si présente
    if (question.image && question.image.trim() !== '') {
        html += `
            <div class="image-container">
                <img src="${question.image}" alt="Image de la question" class="question-image" 
                     onload="this.style.opacity='1'" 
                     onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>❌ Impossible de charger l\\'image<br><small>${question.image}</small></div>'">
            </div>
        `;
    }

    // Question
    html += `<div class="question-text">${renderFormattedQuestion(question.question)}</div>`;

    // --- Adapte ici selon le type ---
    html += '<div class="options-container">';
    if (question.type === 1) {
        // Question ouverte
        html += `
            <input 
                type="text" 
                id="open-answer-input" 
                class="qcm-open-text" 
                placeholder="Votre réponse ici..." 
                autocomplete="off"
                oninput="handleOptionChangeOpen(this.value)"
            >
        `;
    } else {
        // OPTIONS RANDOMISÉES
        const questionIndex = questionOrder[currentQuestionIndex];
        const shuffledIndices = getShuffledOptionIndices(questionIndex);
        shuffledIndices.forEach((originalIdx, displayIdx) => {
            const option = question.options[originalIdx];
            html += `
                <div class="option" data-option="${originalIdx + 1}" id="option-container-${originalIdx + 1}">
                    <input type="checkbox" id="option-${originalIdx + 1}" value="${originalIdx + 1}" onchange="handleOptionChange(${originalIdx + 1})">
                    <label for="option-${originalIdx + 1}" class="option-text">${renderFormattedQuestion(option)}</label>
                </div>
            `;
        });
    }
    html += '</div>';

    // Contrôles d'apprentissage
    html += `
        <div class="learning-controls">
            <button onclick="showCorrectAnswers()" class="show-answer-btn" id="show-answer-btn">
                💡 Afficher la/les bonne(s) réponse(s)
            </button>
            <div id="answer-display" class="answer-revealed" style="display: none;"></div>
        </div>
    `;

    // Suivi des erreurs - masqué en mode révision ET en mode bilan
    if (!isRevisionMode && !isInCompletionMode) {
        html += `
            <div class="error-tracking" onclick="toggleErrorTracking()">
                <input type="checkbox" id="error-checkbox" onchange="handleErrorTracking()">
                <label for="error-checkbox">❌ J'ai eu faux à cette question</label>
            </div>
        `;
    }

    questionContainer.innerHTML = html;
    if (question.type === 1) {
        const openInput = document.getElementById('open-answer-input');
        if (openInput) {
            openInput.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    validateAnswer();
                }
            });
        }
    }
    currentQuestionSpan.textContent = currentQuestionIndex + 1;
    questionIdSpan.textContent = question.id || 'N/A';

    // Restaurer l'état de suivi d'erreur si existant (seulement si pas en mode révision ou bilan)
    if (!isRevisionMode && !isInCompletionMode) {
        const questionId = getCurrentQuestionId();
        const errorCheckbox = document.getElementById('error-checkbox');
        if (errorCheckbox && errorTracking[questionId]) {
            errorCheckbox.checked = true;
        }
    }

    // Mettre à jour le navigateur
    updateNavigatorDisplay();

    clearMessage();
    updateSideNavigationButtons();
}

// Fonction pour afficher les bonnes réponses
function showCorrectAnswers() {
    if (answersRevealed) return;

    const question = getCurrentQuestion();
    const correctAnswer = question.correct_answer;
    const answerDisplay = document.getElementById('answer-display');
    const showAnswerBtn = document.getElementById('show-answer-btn');

    if (question.type === 1) {
    // correctAnswer est toujours un tableau
        const list = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
        answerDisplay.innerHTML = `✅ Bonne(s) réponse(s) attendue(s) : <br><strong>${list.map(ans => renderFormattedQuestion(ans)).join(' &nbsp;|&nbsp; ')}</strong>`;
    } else if (Array.isArray(correctAnswer)) {
        correctAnswer.forEach(correctContent => {
            const optionIndex = question.options.findIndex(option => option === correctContent);
            if (optionIndex !== -1) {
                const optionContainer = document.getElementById(`option-container-${optionIndex + 1}`);
                if (optionContainer) {
                    optionContainer.classList.add('correct-answer');
                }
            }
        });
        answerDisplay.innerHTML = `✅ Bonnes réponses : <br>${correctAnswer.map(ans => renderFormattedQuestion(ans)).join('<br>')}`;
    } else {
        const optionIndex = question.options.findIndex(option => option === correctAnswer);
        if (optionIndex !== -1) {
            const optionContainer = document.getElementById(`option-container-${optionIndex + 1}`);
            if (optionContainer) {
                optionContainer.classList.add('correct-answer');
            }
        }
        answerDisplay.innerHTML = `✅ Bonne réponse : ${renderFormattedQuestion(correctAnswer)}`;
    }

    answerDisplay.style.display = 'block';
    showAnswerBtn.disabled = true;
    showAnswerBtn.textContent = '✅ Réponses affichées';

    answersRevealed = true;
}

// Modifier la fonction handleErrorTracking() existante en ajoutant la sauvegarde :
function handleErrorTracking(event) {
    if (ignoreNextCheckboxChange) {
        ignoreNextCheckboxChange = false;
        return; // on ignore ce changement déclenché par le JS
    }
    if (isRevisionMode || isInCompletionMode) {
        return;
    }
    const questionId = getCurrentQuestionId();
    const isChecked = document.getElementById('error-checkbox').checked;
    if (isChecked) {
        errorTracking[questionId] = true;
    } else {
        delete errorTracking[questionId];
    }
    synchronizeErrorMarking(questionId, isChecked);
    updateNavigatorDisplay();
    if (!isRevisionMode) updateErrorQuestionsList();
    if (!isRevisionMode) saveProgress();

    if (suppressNextErrorTrackingMessage) {
        suppressNextErrorTrackingMessage = false;
        return;
    }
    const action = isChecked ? 'marquée comme fausse' : 'retirée des erreurs';
    const icon = isChecked ? '❌' : '✅';
    showMessage(`${icon} Question ${currentQuestionIndex + 1} ${action}`, isChecked ? 'error' : 'success', 4000);
}

// Gestion de la sélection des options
function handleOptionChange(optionNumber) {
    const checkbox = document.getElementById(`option-${optionNumber}`);
    const question = getCurrentQuestion();
    const optionContent = question.options[optionNumber - 1]; // Récupérer le contenu de l'option
    
    if (checkbox.checked) {
        if (!selectedAnswers.includes(optionContent)) {
            selectedAnswers.push(optionContent);
        }
    } else {
        selectedAnswers = selectedAnswers.filter(answer => answer !== optionContent);
    }
}

function toggleOption(optionNumber) {
    const checkbox = document.getElementById(`option-${optionNumber}`);
    checkbox.checked = !checkbox.checked;
    handleOptionChange(optionNumber);
}

// Modifier la fonction validateAnswer() existante en ajoutant la sauvegarde :
function validateAnswer() {
    const question = getCurrentQuestion();
    const correctAnswer = question.correct_answer;
    let isCorrect = false;

    // Récupère le champ texte si question ouverte
    let openInput = null;
    if (question.type === 1) {
        openInput = document.getElementById('open-answer-input');
    }

    if (question.type === 1) {
        if (!selectedAnswers[0] || selectedAnswers[0].trim() === "") {
            showMessage('Veuillez saisir une réponse.', 'error');
            if (openInput) {
                openInput.classList.remove('qcm-error', 'qcm-success');
            }
            return;
        }
        // --- Correction ici : PAS de .toLowerCase(), juste stripCodeTags sur les 2 chaînes ---
        const userInput = stripCodeTags(selectedAnswers[0].trim());
        const correct = stripCodeTags((typeof correctAnswer === 'string' ? correctAnswer : correctAnswer[0] || "").trim());
        isCorrect = userInput === correct;

        // Animation feedback
        if (openInput) {
            openInput.classList.remove('qcm-error', 'qcm-success'); // reset
            // Force a reflow to restart animation
            void openInput.offsetWidth;
            if (isCorrect) {
                openInput.classList.add('qcm-success');
            } else {
                openInput.classList.add('qcm-error');
            }
        }
    } else if (Array.isArray(correctAnswer)) {
        // (inchangé)
        isCorrect = correctAnswer.length === selectedAnswers.length && 
                   correctAnswer.every(answer => selectedAnswers.includes(answer)) &&
                   selectedAnswers.every(answer => correctAnswer.includes(answer));
    } else {
        isCorrect = selectedAnswers.length === 1 && selectedAnswers[0] === correctAnswer;
    }

    if (isCorrect) {
        showMessage('✅ Bonne réponse ! Passage à la question suivante...', 'success');
        setTimeout(() => {
            // reset feedback visuel avant de passer à la suivante
            if (openInput) openInput.classList.remove('qcm-error', 'qcm-success');
            nextQuestion();
        }, 1500);
    } else if (question.type === 1) {
        showMessage('❌ Réponse incorrecte. Veuillez recommencer.', 'error');
        // Animation déjà appliquée ci-dessus
        setTimeout(() => {
            if (openInput) openInput.classList.remove('qcm-error', 'qcm-success');
        }, 600); // retire la couleur après l'animation
    } else {
        showMessage('❌ Réponse incorrecte. Veuillez recommencer.', 'error');
    }

    saveProgress();
}

// Question suivante
function nextQuestion() {
    currentQuestionIndex++;
    
    const maxQuestions = isRevisionMode ? questionOrder.length : qcmData.qcm.length;
    
    if (currentQuestionIndex >= maxQuestions) {
        showCompletion();
    } else {
        displayQuestion();
        updateProgress();
    }
}

// Mise à jour de la barre de progression
function updateProgress() {
    let totalQuestions, currentProgress;
    
    if (isRevisionMode) {
        totalQuestions = questionOrder.length; // Nombre de questions en révision
        currentProgress = currentQuestionIndex + 1;
    } else {
        totalQuestions = qcmData.qcm.length; // Nombre total de questions
        currentProgress = currentQuestionIndex + 1;
    }
    
    const progress = (currentProgress / totalQuestions) * 100;
    progressFill.style.width = progress + '%';
    
    // Mettre à jour l'affichage du nombre total de questions
    totalQuestionsSpan.textContent = totalQuestions;
}

// Affichage des messages

function showMessage(text, type, duration = 4000) {
    lastMessageId++;
    const myId = lastMessageId;
    let messageClass = 'error-message';
    if (type === 'success') messageClass = 'success-message';
    if (type === 'info') messageClass = 'info-message';

    messageContainer.innerHTML = `<div class="message ${messageClass}">${text}</div>`;
    messageContainer.classList.remove('hide');
    if (messageTimeout) clearTimeout(messageTimeout);
        messageTimeout = setTimeout(function() {
        if (myId === lastMessageId) {
            clearMessage(true); // Efface vraiment le message utilisateur après le délai
        }
    }, duration);;

    // On ne veut pas qu'un clear "système" efface ce message utilisateur :
    persistUserMessage = true;
}

function clearMessage(force = false) {
    if (!force && persistUserMessage) {
        // On ne supprime pas le message utilisateur sauf si c'est un clear "forcé"
        return;
    }
    messageContainer.classList.add('hide');
    setTimeout(() => {
        messageContainer.innerHTML = '';
        messageContainer.classList.remove('hide');
    }, 300);
    persistUserMessage = false;
}

// Calcul des statistiques d'erreurs
function calculateErrorStats() {
    const totalQuestions = qcmData.qcm.length;
    const questionsWithErrors = Object.keys(errorTracking).length;
    const successRate = questionsWithErrors > 0 ? 
        ((questionsWithErrors - questionsWithErrors) / questionsWithErrors * 100).toFixed(1) : 100;
    const errorRate = totalQuestions > 0 ? 
        (questionsWithErrors / totalQuestions * 100).toFixed(1) : 0;
    
    return {
        totalQuestions,
        questionsWithErrors,
        questionsCorrect: totalQuestions - questionsWithErrors,
        successRate: ((totalQuestions - questionsWithErrors) / totalQuestions * 100).toFixed(1),
        errorRate
    };
}

// Fin du QCM
function showCompletion() {
    isInCompletionMode = true; // Activer le mode bilan
    
    // Masquer les éléments de navigation latérale POUR TOUS LES MODES (standard ET révision)
    const elementsToHide = [
        document.getElementById('prev-nav'),
        document.getElementById('next-nav'),
        document.getElementById('keyboard-hint'),
        document.getElementById('error-nav-container')
    ];

    elementsToHide.forEach(element => {
        if (element) {
            element.style.display = 'none';
        }
    });

    let completionHTML = '';
    
    if (isRevisionMode) {
        // Fin du mode révision
        const revisedQuestions = questionOrder.length;
        const newErrors = Object.keys(errorTracking).length;
        
        completionHTML = `
            <div class="completion-card">
                <h2>🎯 Mode révision terminé !</h2>
                <p>Vous avez révisé ${revisedQuestions} question(s) marquée(s) comme fausse(s).</p>
                
                <div class="stats-container">
                    <h3 style="color: #4ade80; margin-bottom: 15px;">📊 Résultats de la révision</h3>
                    
                    <div class="stat-item">
                        <span class="stat-label">Questions révisées :</span>
                        <span class="stat-value">${revisedQuestions}</span>
                    </div>
                    
                    <div class="stat-item">
                        <span class="stat-label">Nouvelles questions marquées fausses :</span>
                        <span class="stat-value error">${newErrors}</span>
                    </div>
                </div>
                
                <div class="revision-exit-buttons">
                    <button class="restart-btn" onclick="exitRevisionMode(true)">
                        ↩️ Retourner au QCM complet (avec progression)
                    </button>
                    <button class="restart-btn" onclick="exitRevisionMode(false)" style="margin-left: 10px;">
                        🆕 Recommencer un nouveau QCM
                    </button>
                    <button class="restart-btn" onclick="restartRevisionMode()" style="margin-left: 10px; background: linear-gradient(135deg, #ef4444, #f87171);">
                        🔄 Refaire cette révision
                    </button>
                </div>
            </div>
        `;
    } else {
        // Fin du QCM normal - reste identique
        const stats = calculateErrorStats();
        
        completionHTML = `
            <div class="completion-card">
                <h2>🎉 Félicitations !</h2>
                <p>Vous avez terminé le QCM avec succès !</p>
                
                <div class="stats-container">
                    <h3 style="color: #4ade80; margin-bottom: 15px;">📊 Statistiques de performance</h3>
                    
                    <div class="stat-item">
                        <span class="stat-label">Total des questions :</span>
                        <span class="stat-value">${stats.totalQuestions}</span>
                    </div>
                    
                    <div class="stat-item">
                        <span class="stat-label">Questions réussies :</span>
                        <span class="stat-value">${stats.questionsCorrect}</span>
                    </div>
                    
                    <div class="stat-item">
                        <span class="stat-label">Questions marquées comme fausses :</span>
                        <span class="stat-value error">${stats.questionsWithErrors}</span>
                    </div>
                    
                    <div class="stat-item">
                        <span class="stat-label">Taux de réussite :</span>
                        <span class="stat-value">${stats.successRate}%</span>
                    </div>
                    
                    <div class="stat-item">
                        <span class="stat-label">Taux d'erreur :</span>
                        <span class="stat-value error">${stats.errorRate}%</span>
                    </div>
                </div>
                
                ${stats.questionsWithErrors > 0 ? `
                    <div style="margin: 20px 0; padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px;">
                        <p style="color: #fca5a5;">💡 <strong>Conseil :</strong> Vous avez marqué ${stats.questionsWithErrors} question(s) comme fausse(s). 
                        Pensez à réviser ces points pour améliorer vos connaissances !</p>
                    </div>
                ` : `
                    <div style="margin: 20px 0; padding: 15px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px;">
                        <p style="color: #86efac;">🌟 <strong>Excellent !</strong> Vous n'avez marqué aucune question comme fausse. 
                        Vos connaissances semblent solides sur ce sujet !</p>
                    </div>
                `}
                
                <div class="completion-buttons">
                    <button class="restart-btn" onclick="returnToCurrentProgress()">
                        ↩️ Retourner au QCM (avec progression actuelle)
                    </button>
                    <button class="restart-btn" onclick="restartQCM()" style="margin-left: 10px;">
                        🔄 Recommencer le QCM
                    </button>
                    <button class="restart-btn" onclick="restartWithShuffle()" style="margin-left: 10px;">
                        🔀 Recommencer avec mélange
                    </button>
                    
                    ${stats.questionsWithErrors > 0 ? `
                        <button class="restart-btn" onclick="restartErrorQuestions()" style="margin-left: 10px; background: linear-gradient(135deg, #ef4444, #f87171);">
                            ❌ Réviser les questions fausses
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    questionContainer.innerHTML = completionHTML;
    validateBtn.style.display = 'none';
    clearMessage();
}

// Redémarrage du QCM
function restartQCM() {
    clearSavedProgress();
    
    // AJOUT : Réinitialiser les modes
    isRevisionMode = false;
    isInCompletionMode = false;
    originalProgressData = null;
    
    // Réafficher tous les éléments de navigation
    showNavigationElements();
    resetShuffledOptions();
    startFreshInit();
    validateBtn.style.display = 'block';
}

// Redémarrage avec mélange
function restartWithShuffle() {
    clearSavedProgress();
    
    // AJOUT : Réinitialiser les modes
    isRevisionMode = false;
    isInCompletionMode = false;
    originalProgressData = null;
    
    // Réafficher tous les éléments de navigation
    showNavigationElements();
    
    questionOrder = shuffleArray(originalOrder);
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    resetShuffledOptions();
    validateBtn.style.display = 'block';
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    showMessage('🔀 Questions mélangées pour ce nouveau QCM !', 'info');
    setTimeout(clearMessage, 2000);
}

// Révision des questions marquées comme fausses
function restartErrorQuestions() {
    const errorQuestionIndices = Object.keys(errorTracking).map(id => parseInt(id));
    
    if (errorQuestionIndices.length === 0) {
        showMessage('Aucune question marquée comme fausse à réviser !', 'info');
        return;
    }
    
    // Sauvegarder la progression actuelle avant d'entrer en mode révision
    originalProgressData = {
        currentQuestionIndex: currentQuestionIndex,
        selectedAnswers: [...selectedAnswers],
        questionOrder: [...questionOrder],
        originalOrder: [...originalOrder],
        errorTracking: {...errorTracking},
        visitedQuestions: new Set(visitedQuestions),
        totalQuestions: qcmData.qcm.length
    };
    
    // Effacer la progression sauvegardée car on démarre un mode spécial
    clearSavedProgress();
    
    // Activer le mode révision
    isRevisionMode = true;
    isInCompletionMode = false; // S'assurer qu'on n'est pas en mode bilan
    
    // Créer un nouveau QCM avec seulement les questions fausses
    questionOrder = errorQuestionIndices;
    currentQuestionIndex = 0;
    selectedAnswers = [];
    visitedQuestions = new Set();
    
    // Réinitialiser le suivi d'erreurs pour cette session de révision
    errorTracking = {};
    
    resetShuffledOptions();

    // Masquer seulement les éléments de navigation d'erreurs en mode révision
    if (errorNavContainer) {
        errorNavContainer.classList.remove('visible');
    }
    
    // AJOUT : S'assurer que la navigation latérale reste visible en mode révision
    const elementsToShow = [
        document.getElementById('prev-nav'),
        document.getElementById('next-nav'),
        document.getElementById('keyboard-hint')
    ];
    
    elementsToShow.forEach(element => {
        if (element) {
            element.style.display = '';
        }
    });
    
    validateBtn.style.display = 'block';
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    updateSideNavigationButtons(); // AJOUT : Mettre à jour l'état des boutons
    
    showMessage(`🎯 Mode révision : ${errorQuestionIndices.length} question(s) à réviser !`, 'info');
    setTimeout(clearMessage, 3000);
}

// Event listeners
validateBtn.addEventListener('click', validateAnswer);

// Event listener pour le bouton scroll to top
scrollToTopBtn.addEventListener('click', scrollToTop);

// Event listeners pour les boutons de navigation des erreurs
prevErrorBtn.addEventListener('click', goToPreviousError);
nextErrorBtn.addEventListener('click', goToNextError);

// Event listener pour le scroll
window.addEventListener('scroll', handleScrollToTopVisibility);

// Remplacer l'event listener existant pour les clics par celui-ci :
document.addEventListener('dblclick', function(e) {
    // Double-clic sur un bouton de navigation des questions
    if (e.target.classList.contains('question-nav-btn')) {
        // Bloquer le marquage d'erreur en mode révision ET mode bilan
        if (isRevisionMode || isInCompletionMode) {
            // Afficher un message d'information spécifique selon le mode
            if (isRevisionMode) {
                showMessage('ℹ️ Le marquage d\'erreurs est désactivé en mode révision', 'info');
            } else if (isInCompletionMode) {
                showMessage('ℹ️ Le marquage d\'erreurs est désactivé en mode bilan', 'info');
            }
            setTimeout(clearMessage, 2000);
            return;
        }
        
        const questionOrderIndex = parseInt(e.target.getAttribute('data-question-index'));
        const questionId = questionOrder[questionOrderIndex];
        
        toggleErrorFromNavigator(questionId, questionOrderIndex);
        
        // Empêcher le comportement par défaut
        e.preventDefault();
        e.stopPropagation();
    }
});

// Initialisation au chargement de la page
window.addEventListener('load', function() {
    loadQCMData();
    handleScrollToTopVisibility(); // Vérifier l'état initial du scroll

    initNavigationElements();
    
    // Event listener pour la navigation clavier
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Afficher l'hint clavier au début
    setTimeout(() => {
        if (keyboardHint) {
            showKeyboardHint();
        }
    }, 1000);
});


// Fonction pour basculer l'état du navigateur
function toggleNavigator() {
    const navigator = document.getElementById('question-navigator');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (!navigator || !toggleIcon) {
        console.error('Éléments du navigateur non trouvés');
        return;
    }
    
    navigatorExpanded = !navigatorExpanded;
    
    if (navigatorExpanded) {
        navigator.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        navigator.classList.add('collapsed');
        toggleIcon.textContent = '▲';
    }
    
    // Sauvegarder l'état dans le localStorage
    localStorage.setItem('navigatorExpanded', navigatorExpanded.toString());
}

// Fonction pour restaurer l'état du navigateur depuis le localStorage
function restoreNavigatorState() {
    const navigator = document.getElementById('question-navigator');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (!navigator || !toggleIcon) {
        return;
    }
    
    const savedState = localStorage.getItem('navigatorExpanded');
    if (savedState !== null) {
        navigatorExpanded = savedState === 'true';
    } else {
        navigatorExpanded = true; // État par défaut
    }
    
    if (navigatorExpanded) {
        navigator.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        navigator.classList.add('collapsed');
        toggleIcon.textContent = '▲';
    }
}

// Fonction pour mettre à jour l'état des boutons de navigation des erreurs
function updateErrorNavigationButtons() {
    if (errorQuestions.length === 0) {
        prevErrorBtn.disabled = true;
        nextErrorBtn.disabled = true;
        return;
    }
    
    prevErrorBtn.disabled = currentErrorIndex <= 0;
    nextErrorBtn.disabled = currentErrorIndex >= errorQuestions.length - 1;
}

// Navigation vers la question fausse précédente
function goToPreviousError() {
    if (errorQuestions.length === 0 || currentErrorIndex <= 0) return;
    
    currentErrorIndex--;
    const questionIndex = errorQuestions[currentErrorIndex];
    goToQuestion(questionIndex);
}

// Navigation vers la question fausse suivante
function goToNextError() {
    if (errorQuestions.length === 0 || currentErrorIndex >= errorQuestions.length - 1) return;
    
    currentErrorIndex++;
    const questionIndex = errorQuestions[currentErrorIndex];
    goToQuestion(questionIndex);
}

function goToRandomError() {
    if (errorQuestions.length === 0) return;
    
    // S'il n'y a qu'une seule question marquée fausse, aller directement dessus
    if (errorQuestions.length === 1) {
        const singleErrorQuestionIndex = errorQuestions[0];
        currentErrorIndex = 0;
        goToQuestion(singleErrorQuestionIndex);
        return;
    }
    
    // S'il y a plusieurs questions, éviter la question actuelle
    let availableErrorQuestions = errorQuestions.filter(questionIndex => questionIndex !== currentQuestionIndex);
    
    // Si toutes les questions fausses sont la question actuelle (cas improbable), prendre toutes les questions
    if (availableErrorQuestions.length === 0) {
        availableErrorQuestions = [...errorQuestions];
    }
    
    // Choisir un index aléatoire parmi les questions disponibles
    const randomIndex = Math.floor(Math.random() * availableErrorQuestions.length);
    const randomErrorQuestionIndex = availableErrorQuestions[randomIndex];
    
    // Mettre à jour l'index actuel des erreurs pour correspondre à la nouvelle question
    currentErrorIndex = errorQuestions.indexOf(randomErrorQuestionIndex);
    
    // Aller à cette question
    goToQuestion(randomErrorQuestionIndex);
}

function startFreshInit() {
    // Créer l'ordre initial des questions (indices)
    originalOrder = qcmData.qcm.map((_, index) => index);
    questionOrder = [...originalOrder];
    
    // Réinitialiser toutes les variables
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    resetShuffledOptions();
    
    totalQuestionsSpan.textContent = qcmData.qcm.length;
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
}

function generateQCMHash(qcmData) {
    const dataString = JSON.stringify(qcmData.qcm);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir en 32-bit
    }
    return hash.toString();
}

function saveProgress() {
    if (!qcmData) return;
    
    const progressData = {
        qcmHash: generateQCMHash(qcmData),
        currentQuestionIndex: currentQuestionIndex,
        selectedAnswers: [...selectedAnswers],
        questionOrder: [...questionOrder],
        originalOrder: [...originalOrder],
        errorTracking: {...errorTracking},
        visitedQuestions: Array.from(visitedQuestions),
        timestamp: Date.now()
    };
    
    localStorage.setItem('qcmProgress', JSON.stringify(progressData));
}

function loadSavedProgress() {
    try {
        const savedData = localStorage.getItem('qcmProgress');
        if (!savedData) return null;
        
        const progressData = JSON.parse(savedData);
        
        // Vérifier si c'est le même QCM
        if (progressData.qcmHash !== generateQCMHash(qcmData)) {
            return null;
        }
        
        return progressData;
    } catch (error) {
        console.error('Erreur lors du chargement de la progression:', error);
        return null;
    }
}

function restoreProgress(progressData) {
    currentQuestionIndex = progressData.currentQuestionIndex;
    selectedAnswers = [...progressData.selectedAnswers];
    questionOrder = [...progressData.questionOrder];
    originalOrder = [...progressData.originalOrder];
    errorTracking = {...progressData.errorTracking};
    visitedQuestions = new Set(progressData.visitedQuestions);
    
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    updateErrorQuestionsList();
    
    showMessage(`✅ Progression restaurée ! Vous êtes à la question ${currentQuestionIndex + 1}/${qcmData.qcm.length}`, 'success');
    setTimeout(clearMessage, 3000);
}

function clearSavedProgress() {
    localStorage.removeItem('qcmProgress');
}

function showRestoreDialog(progressData) {
    const progressDate = new Date(progressData.timestamp).toLocaleString();
    const progressPercent = Math.round(((progressData.currentQuestionIndex + 1) / qcmData.qcm.length) * 100);
    const errorCount = Object.keys(progressData.errorTracking).length;
    
    questionContainer.innerHTML = `
        <div class="restore-dialog">
            <div class="restore-icon">🔄</div>
            <h3>Progression sauvegardée détectée</h3>
            <p>Une progression a été trouvée pour ce QCM :</p>
            
            <div class="progress-info">
                <div class="progress-item">
                    <span class="progress-label">📅 Dernière session :</span>
                    <span class="progress-value">${progressDate}</span>
                </div>
                <div class="progress-item">
                    <span class="progress-label">📊 Progression :</span>
                    <span class="progress-value">${progressData.currentQuestionIndex + 1}/${qcmData.qcm.length} questions (${progressPercent}%)</span>
                </div>
                <div class="progress-item">
                    <span class="progress-label">❌ Questions marquées fausses :</span>
                    <span class="progress-value">${errorCount}</span>
                </div>
                <div class="progress-item">
                    <span class="progress-label">👁️ Questions visitées :</span>
                    <span class="progress-value">${progressData.visitedQuestions.length}</span>
                </div>
            </div>
            
            <div class="restore-buttons">
                <button onclick="restoreProgress(${JSON.stringify(progressData).replace(/"/g, '&quot;')})" class="restore-btn primary">
                    ✅ Continuer où je me suis arrêté
                </button>
                <button onclick="startFreshQCM()" class="restore-btn secondary">
                    🆕 Commencer un nouveau QCM
                </button>
            </div>
            
            <p class="restore-note">
                💡 <strong>Note :</strong> Si vous choisissez de continuer, vous retrouverez exactement où vous vous étiez arrêté avec toutes vos réponses et marquages.
            </p>
        </div>
    `;
}

// Fonction pour démarrer un QCM fresh (sans progression)
function startFreshQCM() {
    clearSavedProgress();
    
    // AJOUT : Réinitialiser les modes
    isRevisionMode = false;
    isInCompletionMode = false;
    originalProgressData = null;
    
    // Réafficher tous les éléments de navigation
    showNavigationElements();
    
    init();
}

function initNavigationElements() {
    prevQuestionBtn = document.getElementById('prev-question-btn');
    nextQuestionBtn = document.getElementById('next-question-btn');
    keyboardHint = document.getElementById('keyboard-hint');
    
    if (prevQuestionBtn) {
        prevQuestionBtn.addEventListener('click', goToPreviousQuestion);
    }
    if (nextQuestionBtn) {
        nextQuestionBtn.addEventListener('click', goToNextQuestion);
    }
}

function goToPreviousQuestion() {
    const maxIndex = isRevisionMode ? questionOrder.length - 1 : qcmData.qcm.length - 1;
    
    if (currentQuestionIndex > 0) {
        // Animation du bouton
        if (prevQuestionBtn) {
            prevQuestionBtn.classList.add('pressed');
            setTimeout(() => prevQuestionBtn.classList.remove('pressed'), 200);
        }
        
        goToQuestion(currentQuestionIndex - 1);
        showKeyboardHint();
    }
}

function goToNextQuestion() {
    const maxIndex = isRevisionMode ? questionOrder.length - 1 : qcmData.qcm.length - 1;
    
    if (currentQuestionIndex < maxIndex) {
        // Animation du bouton
        if (nextQuestionBtn) {
            nextQuestionBtn.classList.add('pressed');
            setTimeout(() => nextQuestionBtn.classList.remove('pressed'), 200);
        }
        
        goToQuestion(currentQuestionIndex + 1);
        showKeyboardHint();
    }
}

function updateSideNavigationButtons() {
    if (!prevQuestionBtn || !nextQuestionBtn || !qcmData) return;
    
    const maxIndex = isRevisionMode ? questionOrder.length - 1 : qcmData.qcm.length - 1;
    
    // Bouton précédent
    prevQuestionBtn.disabled = currentQuestionIndex <= 0;
    
    // Bouton suivant
    nextQuestionBtn.disabled = currentQuestionIndex >= maxIndex;
}

// Fonction pour afficher l'indicateur de navigation clavier
function showKeyboardHint() {
    if (keyboardHint) {
        keyboardHint.classList.add('show');
        setTimeout(() => {
            keyboardHint.classList.remove('show');
        }, 2000);
    }
}

function handleKeyboardNavigation(event) {
    // Bloquer seulement en mode bilan (pas en mode révision)
    if (isInCompletionMode) {
        return;
    }
    
    // Vérifier que nous ne sommes pas dans un champ de saisie
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Vérifier que nous avons bien des données QCM chargées
    if (!qcmData || !qcmData.qcm) {
        return;
    }
    
    switch(event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            goToPreviousQuestion();
            break;
        case 'ArrowRight':
            event.preventDefault();
            goToNextQuestion();
            break;
        case 'Space':
            // Empêcher le scroll de la page avec la barre d'espace
            if (event.target === document.body) {
                event.preventDefault();
            }
            break;
    }
}

function resetQCM() {
    if (!qcmData || !qcmData.qcm) return;
    
    const wasInProgress = currentQuestionIndex > 0 || Object.keys(errorTracking).length > 0 || visitedQuestions.size > 0;
    
    if (wasInProgress) {
        const resetOptions = confirm('⚠️ Réinitialiser le QCM va effacer votre progression.\n\n' +
            'Voulez-vous :\n' +
            '✅ Ok - Réinitialiser complètement\n' +
            '❌ Annuler - Garder ma progression\n\n' +
            'Cliquez "Ok" pour réinitialiser ou "Annuler" pour continuer.');
        
        if (!resetOptions) return;
    }
    
    // Effacer la progression sauvegardée
    clearSavedProgress();
    
    // AJOUT : Réinitialiser les modes
    isRevisionMode = false;
    isInCompletionMode = false;
    originalProgressData = null;
    
    // Réafficher tous les éléments de navigation
    showNavigationElements();
    
    // Réinitialiser complètement toutes les variables
    currentQuestionIndex = 0;
    selectedAnswers = [];
    errorTracking = {};
    visitedQuestions = new Set();
    answersRevealed = false;
    errorQuestions = [];
    currentErrorIndex = -1;
    
    resetShuffledOptions()

    // Recréer l'interface
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    updateErrorQuestionsList();
    
    // Masquer le conteneur de navigation des erreurs
    if (errorNavContainer) {
        errorNavContainer.classList.remove('visible');
    }
    
    // Réafficher le bouton de validation si il était caché
    if (validateBtn) {
        validateBtn.style.display = 'block';
    }
    
    showMessage('🔄 QCM réinitialisé ! Toute votre progression a été effacée.', 'success');
    setTimeout(clearMessage, 3000);
}

function exitRevisionMode(keepProgress) {
    isRevisionMode = false;
    isInCompletionMode = false; // Désactiver le mode bilan
    
    if (keepProgress && originalProgressData) {
        // Restaurer la progression originale
        currentQuestionIndex = 0; // Retourner à la première question
        selectedAnswers = [...originalProgressData.selectedAnswers];
        questionOrder = [...originalProgressData.questionOrder];
        originalOrder = [...originalProgressData.originalOrder];
        errorTracking = {...originalProgressData.errorTracking};
        visitedQuestions = new Set(originalProgressData.visitedQuestions);
        
        // Réafficher TOUS les éléments de navigation (utiliser la fonction existante)
        showNavigationElements();
        
        validateBtn.style.display = 'block';
        createQuestionNavigator();
        displayQuestion();
        updateProgress();
        updateErrorQuestionsList(); 
        
        showMessage('↩️ Retour au QCM complet ! Vous êtes de retour à la première question.', 'success');
        setTimeout(clearMessage, 2000);
    } else {
        // Recommencer complètement
        restartQCM();
    }
    
    originalProgressData = null;
}

// Fonction pour refaire le mode révision
function restartRevisionMode() {
    if (!originalProgressData) {
        showMessage('Erreur: données de révision perdues', 'error');
        return;
    }
    
    // Récupérer les questions qui étaient marquées comme fausses au début de la révision
    const errorQuestionIndices = Object.keys(originalProgressData.errorTracking).map(id => parseInt(id));
    
    // Réinitialiser le mode révision
    questionOrder = errorQuestionIndices;
    currentQuestionIndex = 0;
    selectedAnswers = [];
    visitedQuestions = new Set();
    errorTracking = {};
    
    // Désactiver le mode bilan pour permettre la navigation
    isInCompletionMode = false;
    
    // Réafficher TOUS les éléments de navigation (utiliser la fonction existante)
    showNavigationElements();
    
    validateBtn.style.display = 'block';
    createQuestionNavigator();
    displayQuestion();
    updateProgress();
    updateSideNavigationButtons();
    
    showMessage(`🔄 Révision redémarrée : ${errorQuestionIndices.length} question(s) à réviser !`, 'info');
    setTimeout(clearMessage, 2000);
}

// Fonction pour retourner au QCM avec la progression actuelle (après completion normale)
function returnToCurrentProgress() {
    isInCompletionMode = false; // Désactiver le mode bilan
    
    // Retourner à la première question
    currentQuestionIndex = 0;
    
    // Réafficher tous les éléments de navigation standard
    showNavigationElements();
    
    // Restaurer spécifiquement les éléments de navigation latérale
    const elementsToShow = [
        document.getElementById('prev-nav'),
        document.getElementById('next-nav'),
        document.getElementById('keyboard-hint')
    ];
    
    elementsToShow.forEach(element => {
        if (element) {
            element.style.display = '';
        }
    });
    
    // Remettre le bouton de validation
    validateBtn.style.display = 'block';
    
    displayQuestion();
    updateProgress();
    updateErrorQuestionsList(); // Restaurer la navigation des erreurs
    
    showMessage('↩️ Retour au QCM ! Vous êtes de retour à la première question.', 'info');
    setTimeout(clearMessage, 2000);
}

function toggleErrorTracking() {
    if (isRevisionMode) {
        // Afficher un message explicatif en mode révision
        showMessage('ℹ️ Le marquage d\'erreurs est désactivé en mode révision', 'info');
        setTimeout(clearMessage, 2000);
        return;
    }
    
    if (isInCompletionMode) {
        // Afficher un message explicatif en mode bilan
        showMessage('ℹ️ Le marquage d\'erreurs est désactivé en mode bilan', 'info');
        setTimeout(clearMessage, 2000);
        return;
    }
    
    const checkbox = document.getElementById('error-checkbox');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        handleErrorTracking();
    }
}

function returnToFileSelection() {
    const confirmReturn = confirm('⚠️ Retourner à la sélection de fichier va effacer votre progression actuelle.\n\nContinuer ?');
    
    if (!confirmReturn) return;
    
    // Réinitialiser toutes les variables
    qcmData = null;
    currentQuestionIndex = 0;
    selectedAnswers = [];
    questionOrder = [];
    originalOrder = [];
    errorTracking = {};
    visitedQuestions = new Set();
    isRevisionMode = false;
    isInCompletionMode = false;
    originalProgressData = null;
    
    // Effacer la progression sauvegardée
    clearSavedProgress();
    
    // Afficher l'interface de sélection de fichier
    showFileUploadOption();
    
    showMessage('🔄 Retour à la sélection de fichier', 'info');
    setTimeout(clearMessage, 2000);
}

function toggleErrorFromNavigator(questionId, questionOrderIndex) {
    // Bloquer le marquage d'erreur en mode révision ET en mode bilan
    if (isRevisionMode || isInCompletionMode) {
        return;
    }
    
    // Basculer l'état d'erreur
    const wasMarked = errorTracking[questionId];
    
    if (wasMarked) {
        delete errorTracking[questionId];
    } else {
        errorTracking[questionId] = true;
    }
    
    // Si c'est la question actuelle, synchroniser avec la checkbox
    if (questionOrderIndex === currentQuestionIndex) {
        const errorCheckbox = document.getElementById('error-checkbox');
        if (errorCheckbox) {
            ignoreNextCheckboxChange = true; // signale qu'on ignore le prochain event
            errorCheckbox.checked = !wasMarked;
        }
    }
    
    // Mettre à jour l'affichage
    updateNavigatorDisplay();
    updateErrorQuestionsList();
    
    // Sauvegarder
    saveProgress();
    
    // Afficher le message
    const action = wasMarked ? 'retirée des erreurs' : 'marquée comme fausse';
    const icon = wasMarked ? '✅' : '❌';
    showMessage(`${icon} Question ${questionOrderIndex + 1} ${action}`, wasMarked ? 'success' : 'error', 4000);
}

function synchronizeErrorMarking(questionId, isMarked) {
    // Trouver le bouton correspondant dans le navigateur
    const questionOrderIndex = questionOrder.indexOf(questionId);
    if (questionOrderIndex !== -1) {
        const navButton = document.querySelector(`[data-question-index="${questionOrderIndex}"]`);
        if (navButton) {
            if (isMarked) {
                navButton.classList.add('error-marked');
            } else {
                navButton.classList.remove('error-marked');
            }
        }
    }
}

function hideNavigationForCompletion() {
    const elementsToHide = [
        document.getElementById('prev-nav'),
        document.getElementById('next-nav'),
        document.getElementById('keyboard-hint'),
        document.getElementById('error-nav-container')
    ];
    
    elementsToHide.forEach(element => {
        if (element) {
            element.style.display = 'none';
        }
    });
}

// --- NOUVELLE FONCTION POUR SHUFFLE OPTIONS D'UNE QUESTION ---
function getShuffledOptionIndices(questionIndex) {
    // Si déjà mélangé pour cette question, retourner l'ordre mémorisé
    if (shuffledOptionsMap[questionIndex]) {
        return shuffledOptionsMap[questionIndex];
    }
    // Sinon, générer un nouvel ordre aléatoire pour cette question
    const question = qcmData.qcm[questionIndex];
    const indices = question.options.map((_, idx) => idx);
    const shuffled = shuffleArray(indices);
    shuffledOptionsMap[questionIndex] = shuffled;
    return shuffled;
}

function handleOptionChangeOpen(value) {
    selectedAnswers = [value];
}

// Ajoute cette fonction en haut (après les variables globales par exemple)
function renderFormattedQuestion(text) {
    if (!text) return "";

    // Gère [code]...[/code]
    text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/g, function(match, code) {
        // On échappe le HTML pour protéger l'affichage
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Gère les blocs markdown ```...``` (optionnel)
    text = text.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, function(match, lang, code) {
        return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Gère les inline code `...`
    text = text.replace(/`([^`]+?)`/g, function(match, code) {
        return `<code>${escapeHtml(code)}</code>`;
    });

    return text;
}

// Petite fonction utilitaire pour échapper les caractères HTML
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

function stripCodeTags(str) {
    if (!str) return "";
    return str.replace(/\[code\]|\[\/code\]/gi, '').trim();
}
