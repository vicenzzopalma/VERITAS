import { Button } from "@material-ui/core";
import React, { useRef } from "react";
import { useEffect } from "react";
import { useState } from "react";

const LS_NAME = 'audioMessageRate';

export default function({url}) {
    const audioRef = useRef(null);
    const [audioRate, setAudioRate] = useState( parseFloat(localStorage.getItem(LS_NAME) || "1") );
    const [showButtonRate, setShowButtonRate] = useState(false);

    useEffect(() => {
        audioRef.current.playbackRate = audioRate;
        localStorage.setItem(LS_NAME, audioRate);
    }, [audioRate]);

    useEffect(() => {
        audioRef.current.onplaying = () => {
            setShowButtonRate(true);
        };
        audioRef.current.onpause = () => {
            setShowButtonRate(false);
        };
        audioRef.current.onended = () => {
            setShowButtonRate(false);
        };
    }, []);

    const toogleRate = () => {
        let newRate = null;

        switch(audioRate) {
            case 0.5:
                newRate = 1;
                break;
            case 1:
                newRate = 1.5;
                break;
            case 1.5:
                newRate = 2;
                break;
            case 2:
                newRate = 0.5;
                break;
            default:
                newRate = 1;
                break;
        }
        
        setAudioRate(newRate);
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
            <audio ref={audioRef} controls style={{ width: "100%", maxWidth: 280, minWidth: 220, height: 40, borderRadius: 999 }}>
                <source src={url} type="audio/ogg" />
                <source src={url} type="audio/mp4" />
                <source src={url} type="audio/mpeg" />
                <source src={url} type="audio/wav" />
                Seu navegador não suporta este áudio.
            </audio>
            {showButtonRate && (
                <Button
                    size="small"
                    variant="outlined"
                    style={{ minWidth: 0, padding: "2px 10px", borderRadius: 999, fontSize: "0.72rem", flex: "none" }}
                    onClick={toogleRate}
                >
                    {audioRate}x
                </Button>
            )}
        </div>
    );
}