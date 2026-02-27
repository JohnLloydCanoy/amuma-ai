"use client";
import React, { useState } from 'react';
import Visuals from '../../components/voice/visuals';

export default function HomePage() {

    return (
        <>
            <div className="h-20 text-center" >
                <h1 className="text-4xl font-bold  text-white">Amoma AI</h1>
                    <Visuals  />
            </div>
        </> 
    );
}