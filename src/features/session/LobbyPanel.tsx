"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

const AVATARS = [
  { id: "yellow_bear", src: "/avatars_project/yellow_bear.png" },
  { id: "gray_coala", src: "/avatars_project/gray_coala.png" },
  { id: "panda", src: "/avatars_project/panda.png" },
  { id: "white_bear", src: "/avatars_project/white_bear.png" },
  { id: "monkey", src: "/avatars_project/monkey.png" },
  { id: "brown_mouse", src: "/avatars_project/brown_mouse.png" },
  { id: "skuns", src: "/avatars_project/skuns.png" },
  { id: "orange_cat", src: "/avatars_project/orange_cat.png" },
  { id: "red_parrot", src: "/avatars_project/red_parrot.png" },
  { id: "green_dragon", src: "/avatars_project/green_dragon.png" },
];

type Step = "name" | "avatar";

export function LobbyPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  function handleNameSubmit() {
    if (!name.trim()) {
      setStatus("Please enter your name.");
      return;
    }
    if (!sessionId) {
      setStatus("No session found. Go back and enter a code.");
      return;
    }
    setStatus("");
    setStep("avatar");
  }

  function handleAvatarSelect() {
    if (!selectedAvatar) {
      setStatus("Pick an avatar first.");
      return;
    }
    localStorage.setItem("kahootkz_guest_nickname", name.trim());
    localStorage.setItem("kahootkz_guest_avatar", selectedAvatar);
    router.push(
      `/lobby/confirm?session=${sessionId}&name=${encodeURIComponent(name.trim())}&avatar=${selectedAvatar}`,
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-cyan-500">
      <header className="flex items-center justify-between bg-orange-500 px-6 py-2.5">
        <Link href="/" className="text-xl font-bold text-white">
          Aqyldy quiz
        </Link>
        <Link
          href="/"
          className="rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
        >
          Home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        {step === "name" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNameSubmit();
            }}
            className="flex w-full max-w-xs flex-col items-center"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              className="mb-5 h-12 w-full rounded-md border border-zinc-300 bg-white px-4 text-center text-base font-medium text-zinc-700 outline-none placeholder:text-zinc-400"
            />

            <button
              type="submit"
              className="h-11 w-48 rounded-md bg-orange-500 text-lg font-semibold text-white transition hover:bg-orange-600"
            >
              Enter
            </button>

            {status && (
              <p className="mt-4 text-center text-sm font-medium text-white">
                {status}
              </p>
            )}
          </form>
        )}

        {step === "avatar" && (
          <div className="flex flex-col items-center">
            <div className="w-[620px] bg-[#eeeeee] px-[14px] pt-[12px] pb-[10px]">
              <div className="grid grid-cols-5 gap-[10px]">
                {AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(av.src);
                      setStatus("");
                    }}
                    className={clsx(
                      "flex h-[108px] w-[108px] items-center justify-center bg-[#e7e7e7] transition",
                      selectedAvatar === av.src
                        ? "ring-4 ring-orange-500"
                        : "hover:ring-2 hover:ring-cyan-300",
                    )}
                  >
                    <img
                      src={av.src}
                      alt={av.id}
                      className="h-[88px] w-[88px] object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAvatarSelect}
              className="mt-6 h-[56px] w-[236px] rounded-xl bg-orange-500 text-[20px] font-bold text-white transition hover:bg-orange-600"
            >
              Select
            </button>

            {status && (
              <p className="mt-4 text-center text-sm font-medium text-white">
                {status}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
