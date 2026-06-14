import { IconButton, LinearProgress, Box, Typography, Button, Modal, Fade, Backdrop, Paper } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import ErrorIcon from "@mui/icons-material/Error";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Confetti from "react-confetti";
import { LocalLoadingWrapper } from "@components/loading";
import Quiz from "./quiz";
import { speak } from "@api-services/voiceService";
import { useSelector } from "react-redux";
import { selectToken } from "@app/store/authSlice";


function QuickRevise()
{
    const [question, setQuestion] = useState(null);
    const [, setIsLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
    const [timer, setTimer] = useState(0);
    const [initialTimer, setInitialTimer] = useState(0);
    const [score, setScore] = useState(0);
    const [gameOverState, setGameOverState] = useState({
        isOpen: false,
        reason: null,
        correctAnswer: null,
        finalScore: 0
    });
    const ws = useRef(null);
    const navigate = useNavigate();
    const { deckID } = useParams();
    const token = useSelector(selectToken);

    const correctSound = new Audio(`${process.env.PUBLIC_URL}/sound/true.mp3`);
    const incorrectSound = new Audio(`${process.env.PUBLIC_URL}/sound/false.mp3`);
    const finishSound = new Audio(
        `${process.env.PUBLIC_URL}/sound/congratulation.mp3`
    );

    useEffect(() =>
    {
        // Determine WS Protocol based on window location
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        // If backend is on 8000 (standard django port), we might need to adjust.
        // Docker compose maps 8000. But if runserver, it's 8000.
        // The previous analysis showed backend on 8000/8005. 
        // .env might have BASE_BACKEND_URL.
        // Let's rely on relative path if proxied, or hardcode/env var.
        // The plan said ws://localhost:8000/ws/quick-revise/.
        // NOTE: In production or docker, it might be different.
        // I'll try to deduce it or use a default.
        const wsUrl = `${protocol}//${process.env.REACT_APP_SOCKET_URL}/quick-revise/`;


        ws.current = new WebSocket(`${wsUrl}?token=${token?.access}&deck_id=${deckID}`);

        ws.current.onopen = () =>
        {
            ws.current.send(JSON.stringify({ action: "start" }));
            setIsLoading(false);
        };

        ws.current.onmessage = (event) =>
        {
            const data = JSON.parse(event.data);
            if (data.type === "new_question") {
                setQuestion(data.question);
                setTimer(data.time_limit);
                setInitialTimer(data.time_limit);
            } else if (data.type === "result") {
                // Handled by local feedback mostly, but we can verify
                if (data.correct) {
                    setScore((prev) => prev + 1);
                }
            } else if (data.type === "finished") {
                finishSound.play();
                setShowConfetti(true);
                setTimeout(() => navigate(-1), 3000); // Go back after 3s
            } else if (data.type === "game_over") {
                if (data.reason === 'wrong_answer') {
                    incorrectSound.play();
                }
                setGameOverState({
                    isOpen: true,
                    reason: data.reason,
                    correctAnswer: data.correct_answer,
                    finalScore: data.final_score ?? score // Use backend score or local score
                });
            } else if (data.type === "error") {
                toast.error(data.message);
                navigate(-1);
            }
        };

        ws.current.onclose = () => {};

        return () =>
        {
            if (ws.current) {
                ws.current.close();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deckID, token]);

    useEffect(() =>
    {
        let interval;
        if (timer > 0) {
            interval = setInterval(() =>
            {
                setTimer((prev) =>
                {
                    if (prev <= 0.1) return 0;
                    return prev - 0.1
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const speakTerm = () =>
    {
        if (question) {
            speak(question.answer);
        }
    };

    const handleCorrect = () =>
    {
        correctSound.play();
        speakTerm();
        ws.current.send(JSON.stringify({ action: "answer", answer: question.answer }));
        // Quiz/Fill component handles visual feedback, we wait for next question from WS
    };

    const handleIncorrect = () =>
    {
        incorrectSound.play();
        speakTerm();
        // Send wrong answer or just trigger game over on server
        // We can send a wrong string
        ws.current.send(JSON.stringify({ action: "answer", answer: "!WRONG!" }));
    };

    const showNext = () =>
    {
        // This is called by Quiz/Fill after they show feedback.
        // In Quick Revise, the "Next" is automatic via WebSocket pushing new question.
        // So we don't need to do anything here to fetch next.
    };

    const handleReplay = () =>
    {
        setGameOverState({ ...gameOverState, isOpen: false });
        setScore(0);
        setIsLoading(true);
        // Small delay to allow UI to reset before sending start
        setTimeout(() =>
        {
            if (ws.current) {
                ws.current.send(JSON.stringify({ action: "start" }));
            }
        }, 300);
    };

    const handleExit = () =>
    {
        navigate(-1);
    };

    if (!question) return <LocalLoadingWrapper open={true} />;

    const progress = initialTimer > 0 ? (timer / initialTimer) * 100 : 0;
    // Dynamic color for progress bar
    let progressColor = "primary"; // Blue default
    if (timer < 3) progressColor = "error"; // Red
    else if (timer < 5) progressColor = "warning"; // Orange

    return (
        <div className="learn-wrapper">
            {/* Game Over Modal */}
            <Modal
                open={gameOverState.isOpen}
                onClose={handleExit}
                closeAfterTransition
                slots={{ backdrop: Backdrop }}
                slotProps={{
                    backdrop: {
                        timeout: 500,
                        style: { backgroundColor: 'rgba(0, 0, 0, 0.8)' } // Darker backdrop
                    },
                }}
            >
                <Fade in={gameOverState.isOpen}>
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 400,
                        bgcolor: 'background.paper',
                        boxShadow: 24,
                        p: 4,
                        borderRadius: 4,
                        textAlign: 'center',
                        outline: 'none'
                    }}>
                        {/* Status Icon */}
                        <Box sx={{ mb: 2 }}>
                            {gameOverState.reason === 'timeout' ? (
                                <AccessTimeFilledIcon sx={{ fontSize: 60, color: 'warning.main' }} />
                            ) : (
                                <ErrorIcon sx={{ fontSize: 60, color: 'error.main' }} />
                            )}
                        </Box>

                        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
                            {gameOverState.reason === 'timeout' ? "Time's up!" : "Game over"}
                        </Typography>

                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Final score: {gameOverState.finalScore}
                        </Typography>

                        {gameOverState.reason === 'wrong_answer' && (
                            <Paper elevation={0} sx={{ bgcolor: '#f5f5f5', p: 2, my: 2, borderRadius: 2 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Correct answer:
                                </Typography>
                                <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                                    {gameOverState.correctAnswer}
                                </Typography>
                            </Paper>
                        )}

                        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<ReplayIcon />}
                                onClick={handleReplay}
                                size="large"
                                sx={{ borderRadius: 2, px: 4 }}
                            >
                                Replay
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<ExitToAppIcon />}
                                onClick={handleExit}
                                size="large"
                                sx={{ borderRadius: 2, px: 4 }}
                            >
                                Exit
                            </Button>
                        </Box>
                    </Box>
                </Fade>
            </Modal>

            {showConfetti && (
                <Confetti
                    gravity={0.2}
                    width={window.innerWidth}
                    height={window.innerHeight}
                />
            )}
            <div className="learn-header">
                <div className="left-header" style={{ width: '100%', paddingRight: '20px' }}>
                    <Box sx={{ width: '100%' }}>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            color={progressColor}
                            sx={{ height: 10, borderRadius: 5 }}
                        />
                    </Box>
                </div>
                <div className="center-header">
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            background: 'rgba(255, 255, 255, 0.1)', // Subtle background
                            padding: '4px 16px',
                            borderRadius: '20px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: '600', color: 'text.secondary' }}>
                            Revise
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff9800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🔥 {score}
                        </Typography>
                    </Box>
                </div>
                <div className="right-header">
                    <div className="close-btn">
                        <IconButton component="label" onClick={() => navigate(-1)}>
                            <CloseIcon />
                        </IconButton>
                    </div>
                </div>
            </div>
            <div className="learn-body">
                <div className="learn-container">
                    <Quiz
                        question={question}
                        speakTerm={speakTerm}
                        handleCorrect={handleCorrect}
                        handleIncorrect={handleIncorrect}
                        showNext={showNext}
                        setIsLoading={setIsLoading}
                    />
                </div>
            </div>
        </div>
    );
}

export default QuickRevise;
