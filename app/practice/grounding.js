// =========================================================
// PRACTICE — GROUNDING 5–4–3–2–1
// =========================================================


// =========================================================
// ELEMENTS
// =========================================================

const openGrounding =
  document.getElementById('openGrounding');

const practicePage =
  document.querySelector('.practice-page');

const groundingExercise =
  document.getElementById('groundingExercise');

const groundingStart =
  document.getElementById('groundingStart');

const groundingIntro =
  document.getElementById('groundingIntro');

const groundingSession =
  document.getElementById('groundingSession');

const groundingComplete =
  document.getElementById('groundingComplete');

const groundingTimer =
  document.getElementById('groundingTimer');

const groundingStep =
  document.getElementById('groundingStep');

const groundingProgressBar =
  document.getElementById('groundingProgressBar');

const groundingNumber =
  document.getElementById('groundingNumber');

const groundingSense =
  document.getElementById('groundingSense');

const groundingTitle =
  document.getElementById('groundingTitle');

const groundingInstruction =
  document.getElementById('groundingInstruction');

const groundingRestart =
  document.getElementById('groundingRestart');

const groundingExit =
  document.getElementById('groundingExit');


// =========================================================
// COMPLETION SOUND
// =========================================================

// MP3 nằm trong folder assets
const groundingCompleteSound =
  new Audio('practice/duolingo-completed-lesson.mp3');

groundingCompleteSound.preload = 'auto';
groundingCompleteSound.volume = 0.5;


// =========================================================
// EXERCISE DATA
// =========================================================

const groundingSteps = [

  {
    number: 5,

    senseVi: 'NHÌN THẤY',
    senseEn: 'SEE',

    titleVi: 'Tìm 5 thứ bạn có thể nhìn thấy.',
    titleEn: 'Find 5 things you can see.',

    instructionVi:
      'Quan sát chậm xung quanh bạn và chú ý đến màu sắc, hình dạng hoặc những chi tiết nhỏ.',

    instructionEn:
      'Slowly look around you and notice colors, shapes, or small details.'
  },

  {
    number: 4,

    senseVi: 'CHẠM',
    senseEn: 'TOUCH',

    titleVi: 'Tìm 4 thứ bạn có thể chạm vào.',
    titleEn: 'Notice 4 things you can touch.',

    instructionVi:
      'Cảm nhận bề mặt, nhiệt độ hoặc kết cấu của những vật ở gần bạn.',

    instructionEn:
      'Notice the texture, temperature, or surface of things around you.'
  },

  {
    number: 3,

    senseVi: 'NGHE',
    senseEn: 'HEAR',

    titleVi: 'Tìm 3 âm thanh bạn có thể nghe.',
    titleEn: 'Notice 3 sounds you can hear.',

    instructionVi:
      'Lắng nghe những âm thanh gần và xa mà bạn có thể nhận ra.',

    instructionEn:
      'Listen for sounds near and far that you can notice.'
  },

  {
    number: 2,

    senseVi: 'NGỬI',
    senseEn: 'SMELL',

    titleVi: 'Tìm 2 thứ bạn có thể ngửi thấy.',
    titleEn: 'Notice 2 things you can smell.',

    instructionVi:
      'Nhẹ nhàng chú ý đến những mùi hương xung quanh bạn.',

    instructionEn:
      'Gently notice the scents and smells around you.'
  },

  {
    number: 1,

    senseVi: 'NẾM',
    senseEn: 'TASTE',

    titleVi: 'Nhận biết 1 vị bạn có thể nếm.',
    titleEn: 'Notice 1 taste you can experience.',

    instructionVi:
      'Nếu có thể, hãy chú ý đến một vị đang có trong miệng. Không cần ăn hoặc uống thêm bất cứ thứ gì.',

    instructionEn:
      'If possible, notice a taste that is already present. You do not need to eat or drink anything.'
  }

];


// =========================================================
// TIMER
// =========================================================

let groundingCurrentStep = 0;

let groundingTimerId = null;

let groundingEndTime = null;

let groundingReturnTimeout = null;


// =========================================================
// TIMER DURATION
// =========================================================

// ĐANG TEST
// 1 giây mỗi bước

const GROUNDING_STEP_DURATION = 15 * 1000;


// Khi hoàn thành test xong,
// đổi thành:
//
// const GROUNDING_STEP_DURATION = 60 * 1000;


// =========================================================
// OPEN GROUNDING FROM CARD
// =========================================================

if (openGrounding && groundingExercise) {

  openGrounding.addEventListener('click', () => {

    clearInterval(groundingTimerId);
    clearTimeout(groundingReturnTimeout);

    groundingCurrentStep = 0;


    // Hide Practice
    if (practicePage) {
      practicePage.classList.add('hidden');
    }


    // Show Grounding
    groundingExercise.classList.remove('hidden');


    // Reset states
    groundingIntro.classList.remove('hidden');

    groundingSession.classList.add('hidden');

    groundingComplete.classList.add('hidden');


    // Reset progress
    if (groundingProgressBar) {
      groundingProgressBar.style.width = '0%';
    }


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  });

}


// =========================================================
// UPDATE CURRENT STEP
// =========================================================

function updateGroundingStep() {

  const step =
    groundingSteps[groundingCurrentStep];

  if (!step) return;


  // Step counter

  groundingStep.textContent =
    `${groundingCurrentStep + 1} / ${groundingSteps.length}`;


  // Number

  groundingNumber.textContent =
    step.number;


  // Sense

  groundingSense.innerHTML = `
    <span lang-el="vi">${step.senseVi}</span>
    <span lang-el="en">${step.senseEn}</span>
  `;


  // Title

  groundingTitle.innerHTML = `
    <span lang-el="vi">${step.titleVi}</span>
    <span lang-el="en">${step.titleEn}</span>
  `;


  // Instruction

  groundingInstruction.innerHTML = `
    <span lang-el="vi">${step.instructionVi}</span>
    <span lang-el="en">${step.instructionEn}</span>
  `;


  // Progress

  groundingProgressBar.style.width =
    `${(groundingCurrentStep / groundingSteps.length) * 100}%`;


  // Start timer

  startGroundingTimer();

}


// =========================================================
// START TIMER
// =========================================================

function startGroundingTimer() {

  clearInterval(groundingTimerId);


  groundingEndTime =
    Date.now() + GROUNDING_STEP_DURATION;


  function updateTimer() {

    const remaining =
      Math.max(
        0,
        groundingEndTime - Date.now()
      );


    const totalSeconds =
      Math.ceil(remaining / 1000);


    const minutes =
      Math.floor(totalSeconds / 60);


    const seconds =
      totalSeconds % 60;


    groundingTimer.textContent =
      `${minutes}:${String(seconds).padStart(2, '0')}`;


    // =====================================================
    // TIME IS UP
    // =====================================================

    if (remaining <= 0) {

      clearInterval(groundingTimerId);

      groundingTimer.textContent = '0:00';


      // ===================================================
      // LAST STEP
      // ===================================================

      if (
        groundingCurrentStep >=
        groundingSteps.length - 1
      ) {

        // Fill progress completely

        groundingProgressBar.style.width = '100%';


        // Finish exercise

        finishGrounding();

        return;
      }


      // ===================================================
      // NEXT STEP
      // ===================================================

      groundingCurrentStep++;

      updateGroundingStep();

    }

  }


  // Run immediately

  updateTimer();


  // Update every 250ms

  groundingTimerId =
    setInterval(updateTimer, 250);

}


// =========================================================
// START EXERCISE
// =========================================================

if (groundingStart) {

  groundingStart.addEventListener('click', () => {

    clearInterval(groundingTimerId);
    clearTimeout(groundingReturnTimeout);


    groundingCurrentStep = 0;


    // =====================================================
    // PREPARE AUDIO
    // =====================================================
    //
    // Safari may block audio that has never been activated
    // by a user interaction.
    //
    // We briefly play it silently here ONLY to unlock it.
    // The user will NOT hear the sound at this point.
    //

    groundingCompleteSound.volume = 0;

    groundingCompleteSound.currentTime = 0;

    groundingCompleteSound.play()
      .then(() => {

        groundingCompleteSound.pause();

        groundingCompleteSound.currentTime = 0;

        // Restore actual volume
        groundingCompleteSound.volume = 0.5;

      })
      .catch(() => {

        // Restore volume even if unlock fails
        groundingCompleteSound.volume = 0.5;

      });


    // =====================================================
    // SHOW SESSION
    // =====================================================

    groundingIntro.classList.add('hidden');

    groundingComplete.classList.add('hidden');

    groundingSession.classList.remove('hidden');


    // Start first step

    updateGroundingStep();


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  });

}


// =========================================================
// CONFETTI
// =========================================================

function launchConfetti() {

  // Remove existing confetti canvas
  // in case something is still there.

  const oldCanvas =
    document.getElementById('groundingConfetti');

  if (oldCanvas) {
    oldCanvas.remove();
  }


  // Create canvas

  const canvas =
    document.createElement('canvas');

  canvas.id =
    'groundingConfetti';


  // Canvas styling

  canvas.style.position =
    'fixed';

  canvas.style.inset =
    '0';

  canvas.style.width =
    '100vw';

  canvas.style.height =
    '100vh';

  canvas.style.pointerEvents =
    'none';

  canvas.style.zIndex =
    '9999';


  document.body.appendChild(canvas);


  // Context

  const ctx =
    canvas.getContext('2d');


  // Canvas size

  function resizeCanvas() {

    canvas.width =
      window.innerWidth;

    canvas.height =
      window.innerHeight;

  }


  resizeCanvas();


  // =======================================================
  // CONFETTI PARTICLES
  // =======================================================

  const pieces = [];

  const particleCount = 120;


  for (
    let i = 0;
    i < particleCount;
    i++
  ) {

    pieces.push({

      x:
        Math.random() *
        canvas.width,

      y:
        -20 -
        Math.random() *
        canvas.height *
        0.3,

      width:
        6 +
        Math.random() *
        6,

      height:
        8 +
        Math.random() *
        8,

      speedY:
        3 +
        Math.random() *
        4,

      speedX:
        (Math.random() - 0.5) * 3,

      rotation:
        Math.random() *
        Math.PI,

      rotationSpeed:
        (Math.random() - 0.5) * 0.2,

      gravity:
        0.08 +
        Math.random() * 0.05,

      opacity: 1

    });

  }


  // =======================================================
  // COLORS
  // =======================================================

  const colors = [

    '#7B4B7A',

    '#00ff84ff',

    '#D8A84E',

    '#ff0000ff',

    '#0055ffff'

  ];


  // =======================================================
  // ANIMATION
  // =======================================================

  let animationFrame = null;

  const startTime =
    performance.now();


  function animate(now) {

    const elapsed =
      now - startTime;


    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    pieces.forEach(
      (piece, index) => {

        // Gravity

        piece.speedY +=
          piece.gravity;


        // Movement

        piece.y +=
          piece.speedY;

        piece.x +=
          piece.speedX;


        // Rotation

        piece.rotation +=
          piece.rotationSpeed;


        // Fade near end

        if (elapsed > 2200) {

          piece.opacity =
            Math.max(
              0,
              1 -
                (elapsed - 2200) /
                800
            );

        }


        // Draw

        ctx.save();


        ctx.translate(
          piece.x,
          piece.y
        );


        ctx.rotate(
          piece.rotation
        );


        ctx.globalAlpha =
          piece.opacity;


        ctx.fillStyle =
          colors[
            index % colors.length
          ];


        ctx.fillRect(
          -piece.width / 2,
          -piece.height / 2,
          piece.width,
          piece.height
        );


        ctx.restore();

      }
    );


    // Continue animation

    if (elapsed < 5000) {

      animationFrame =
        requestAnimationFrame(
          animate
        );

    }

    // Finish

    else {

      if (animationFrame) {

        cancelAnimationFrame(
          animationFrame
        );

      }


      window.removeEventListener(
        'resize',
        resizeCanvas
      );


      canvas.remove();

    }

  }


  window.addEventListener(
    'resize',
    resizeCanvas
  );


  requestAnimationFrame(
    animate
  );

}


// =========================================================
// COMPLETE EXERCISE
// =========================================================

function finishGrounding() {

  clearInterval(
    groundingTimerId
  );


  // =====================================================
  // CONFETTI
  // =====================================================

  launchConfetti();


  // =====================================================
  // COMPLETION SOUND
  // =====================================================

  groundingCompleteSound.volume =
    0.5;

  groundingCompleteSound.currentTime =
    0;


  groundingCompleteSound.play()
    .then(() => {

      console.log(
        '🔊 Completion sound played'
      );

    })
    .catch((error) => {

      console.error(
        '❌ Completion sound failed:',
        error
      );

    });


  // =====================================================
  // SHOW COMPLETION PAGE
  // =====================================================

  groundingSession.classList.add(
    'hidden'
  );

  groundingComplete.classList.remove(
    'hidden'
  );


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });


  // =====================================================
  // RETURN TO PRACTICE AFTER 3 SECONDS
  // =====================================================

  clearTimeout(
    groundingReturnTimeout
  );


  groundingReturnTimeout =
    setTimeout(() => {

      // Hide completion

      groundingComplete.classList.add(
        'hidden'
      );


      // Hide Grounding

      groundingExercise.classList.add(
        'hidden'
      );


      // Show Practice

      if (practicePage) {

        practicePage.classList.remove(
          'hidden'
        );

      }


      // Reset state

      groundingCurrentStep = 0;


      groundingIntro.classList.remove(
        'hidden'
      );


      groundingSession.classList.add(
        'hidden'
      );


      // Reset progress

      if (groundingProgressBar) {

        groundingProgressBar.style.width =
          '0%';

      }


      // Back to top

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });


    }, 10000);

}


// =========================================================
// EXIT EXERCISE
// =========================================================

if (groundingExit) {

  groundingExit.addEventListener(
    'click',
    () => {

      // Stop timer

      clearInterval(
        groundingTimerId
      );


      // Cancel return timer

      clearTimeout(
        groundingReturnTimeout
      );


      // Reset step

      groundingCurrentStep = 0;


      // Stop completion sound

      groundingCompleteSound.pause();

      groundingCompleteSound.currentTime =
        0;


      // Remove confetti if present

      const confetti =
        document.getElementById(
          'groundingConfetti'
        );

      if (confetti) {
        confetti.remove();
      }


      // Hide Grounding

      groundingExercise.classList.add(
        'hidden'
      );


      groundingSession.classList.add(
        'hidden'
      );


      groundingComplete.classList.add(
        'hidden'
      );


      // Reset Intro

      groundingIntro.classList.remove(
        'hidden'
      );


      // Reset progress

      if (groundingProgressBar) {

        groundingProgressBar.style.width =
          '0%';

      }


      // Show Practice

      if (practicePage) {

        practicePage.classList.remove(
          'hidden'
        );

      }


      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

    }
  );

}


// =========================================================
// RESTART
// =========================================================

if (groundingRestart) {

  groundingRestart.addEventListener(
    'click',
    () => {

      clearInterval(
        groundingTimerId
      );


      clearTimeout(
        groundingReturnTimeout
      );


      // Reset step

      groundingCurrentStep = 0;


      // Stop sound

      groundingCompleteSound.pause();

      groundingCompleteSound.currentTime =
        0;


      // Remove confetti

      const confetti =
        document.getElementById(
          'groundingConfetti'
        );

      if (confetti) {
        confetti.remove();
      }


      // Hide completion

      groundingComplete.classList.add(
        'hidden'
      );


      // Show intro

      groundingIntro.classList.remove(
        'hidden'
      );


      // Hide session

      groundingSession.classList.add(
        'hidden'
      );


      // Reset progress

      if (groundingProgressBar) {

        groundingProgressBar.style.width =
          '0%';

      }


      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

    }
  );

}