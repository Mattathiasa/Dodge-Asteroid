$(document).ready(function () {
    var gameBox = $('#game-box');
    var ball = $('#ball');
    var levelDisplay = $('#level-display');
    var startButton = $('#start-button');
    var pauseButton = $('#pause-button');
    var resetButton = $('#reset-button');
    var level = 0;
    var isGameRunning = false;
    var isGamePaused = false;
    var collisionCheckInterval;
    var asteroidSpeed = 2;
    var asteroidInterval;
    var asteroids = [];//new array to store asteroid position
    var isAnimationPaused = false;
    resetButton.on('click', resetGame);
    // Generate a random number between min and max
    function getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    // Move the ball
    function moveBall(event) {
        if (!isGameRunning || isGamePaused) return;

        var boxWidth = gameBox.width();
        var boxHeight = gameBox.height();
        var ballWidth = ball.width();
        var ballHeight = ball.height();
        var mouseX = event.pageX - gameBox.offset().left;
        var mouseY = event.pageY - gameBox.offset().top;

        // Calculate the new position for the ball
        var newLeft = mouseX - ballWidth / 2;
        var newTop = mouseY - ballHeight / 2;

        // Check if the ball is within the box
        if (newLeft >= 0 && newLeft <= boxWidth - ballWidth) {
            ball.css({
                left: newLeft + 'px',
            });
        }

        if (newTop >= 0 && newTop <= boxHeight - ballHeight) {
            ball.css({
                top: newTop + 'px',
            });

            // Check for collision with asteroids
            $('.asteroid').each(function () {
                if (isColliding(ball, $(this))) { //this is the current asteroid element
                    gameOver();
                    return false;
                }
            });
        }
    }

    // Check if two elements are colliding
    function isColliding(element1, element2) {
        var x1 = element1.offset().left + element1.width() / 2;
        var y1 = element1.offset().top + element1.height() / 2;
        var x2 = element2.offset().left + element2.width() / 2;
        var y2 = element2.offset().top + element2.height() / 2;

        var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (distance <= (element1.width() / 2 + element2.width() / 2)) {
            alert("Game Over" + "  " + 'Level: ' + level)
            $('#reset-button').click();
        }

        return
    }

    // Create a new asteroid
    function createAsteroid() {
        var asteroid = $('<div class="asteroid"></div>');
        var boxWidth = gameBox.width();
        var asteroidSize = getRandomNumber(20, 40);


        var asteroidStart = getRandomNumber(0, boxWidth - asteroidSize);
        var asteroidEnd = getRandomNumber(0, boxWidth - asteroidSize);

        asteroid.css({
            top: -asteroidSize + 'px',
            left: asteroidStart + 'px',
            width: asteroidSize + 'px',
            height: asteroidSize + 'px'
        });
        asteroidSpeed /= 1.09;

        if (isAnimationPaused) {
            var currentTop = asteroid.position().top;
            var remainingTime = (gameBox.height() - currentTop) / asteroidSpeed;

            asteroid.animate({
                top: gameBox.height() + asteroidSize + 'px',
                left: asteroidEnd + 'px'
            }, remainingTime * 1000, 'linear', function () {
                $(this).remove();
            });
        } else {
            asteroid.animate({
                top: gameBox.height() + asteroidSize + 'px',
                left: asteroidEnd + 'px'
            }, asteroidSpeed * 1000, 'linear', function () {
                $(this).remove();
            });
        }

        // Append the asteroid to the game box
        gameBox.append(asteroid);
        if (isGameRunning && !isGamePaused) {
            level++;
            levelDisplay.text('Level: ' + level);

        }
        asteroids.push({ // Store asteroid position in the array
            element: asteroid,
            top: asteroid.position().top,
            left: asteroid.position().left
        });
        setInterval(() => {
            this.asteroidSpeed = asteroidSpeed / 100;
        }, 2000);



    }

    // Start the game
    function startGame() {
        if (isGameRunning) return;

        isGameRunning = true;
        startButton.prop('disabled', true);
        pauseButton.prop('disabled', false);
        resetButton.prop('disabled', false);
        asteroidSpeed = 2;
        asteroidInterval = setInterval(createAsteroid, 1000);
        collisionCheckInterval = setInterval(function () {
            $('.asteroid').each(function () {
                if (isColliding(ball, $(this))) {
                    gameOver();
                    return false; //to breack out of each()
                }

            });
        }, 10);


    }

    // Pause the game
    var isGamePaused = false; // Initialize the game paused state

    pauseButton.on('click', function () {
        isGamePaused = !isGamePaused;
        isAnimationPaused = !isAnimationPaused;

        if (isGamePaused) {
            pauseButton.text('Resume');
            clearInterval(asteroidInterval);
            $('.asteroid').stop();
        } else {
            pauseButton.text('Pause');
            asteroidInterval = setInterval(createAsteroid, 1000);
            animateAsteroids();
        }
    });



    // End the game
    function gameOver() {
        clearInterval(asteroidInterval);
        clearInterval(collisionCheckInterval);
        isGameRunning = false;
        startButton.prop('disabled', false);
        pauseButton.prop('disabled', true);
        resetButton.prop('disabled', false);
        pauseButton.text('Pause');
        level = 0;
        levelDisplay.text('Level: ' + level);
        $('.asteroid').remove();
    }

    // Reset the game
    function resetGame() {
        clearInterval(asteroidInterval);
        clearInterval(collisionCheckInterval);
        asteroidSpeed = 2;
        isGameRunning = false;
        startButton.prop('disabled', false);
        pauseButton.prop('disabled', true);
        resetButton.prop('disabled', true);
        pauseButton.text('Pause');
        level = 0;
        levelDisplay.text('Level: ' + level);
        $('.asteroid').remove();

        // Reset the ball position
        var boxWidth = gameBox.width();
        var boxHeight = gameBox.height();
        var ballWidth = ball.width();
        var ballHeight = ball.height();
        var initialLeft = (boxWidth - ballWidth) / 2;
        var initialTop = (boxHeight - ballHeight) / 2;
        ball.css({
            left: initialLeft + 'px',
            top: initialTop + 'px'
        });

        // Clear the asteroids array
        asteroids = [];
    }



    // Bind the moveBall() function to the mousemove event on the game box
    gameBox.on('mousemove', moveBall);

    // Bind startGame() to the click event of the start button
    startButton.on('click', startGame);

    // Bind pauseGame() to the click event of the pause button
    pauseButton.on('click', pauseGame);

    // Bind resetGame() to the click event of the reset button
    resetButton.on('click', resetGame);
});