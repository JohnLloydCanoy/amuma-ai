"use client";
import React, { useState } from 'react';
import Visuals from '../../components/voice/visuals';

export default function HomePage() {

    return (
        <>


            <Visuals  />


        <button 
            onClick={() => setIsSpeaking(!isSpeaking)}
            className="px-6 py-3 bg-slate-600 text-white rounded-full font-medium hover:bg-slate-700 transition-colors shadow-md"
        >
            {isSpeaking ? "Stop AI Speech" : "Simulate AI Speaking"}
        </button>

            </>
    );
}