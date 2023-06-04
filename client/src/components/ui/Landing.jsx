import React, { useState, useContext } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import useDocumentTitle from '~/hooks/useDocumentTitle';
import Templates from '../ui/Templates';
import SunIcon from '../svg/SunIcon';
import LightningIcon from '../svg/LightningIcon';
import CautionIcon from '../svg/CautionIcon';
import ChatIcon from '../svg/ChatIcon';
import { ThemeContext } from '~/hooks/ThemeContext';

import store from '~/store';

export default function Landing() {
  const [showingTemplates, setShowingTemplates] = useState(false);
  const setText = useSetRecoilState(store.text);
  const conversation = useRecoilValue(store.conversation);
  const { title = 'New Chat' } = conversation || {};
  const { theme, setTheme } = useContext(ThemeContext);

  useDocumentTitle(title);

  const clickHandler = (e) => {
    e.preventDefault();
    const { innerText } = e.target;
    const quote = innerText.split('"')[1].trim();
    setText(quote);
  };

  const showTemplates = (e) => {
    e.preventDefault();
    setShowingTemplates(!showingTemplates);
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto pt-0 text-sm dark:bg-gray-800"
    style={ theme === 'dark' ?{
      backgroundImage: "url('https://climateactiondata.org/wp-content/uploads/2022/10/home-banner-2.jpg')",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    } : {
      /* No Background Image for light mode */
    }}
    >
      <div className="w-full px-6 text-gray-800 dark:text-gray-100 md:flex md:max-w-2xl md:flex-col lg:max-w-3xl">
        <h1
          id="landing-title"
          className="mb-10 ml-auto mr-auto mt-6 flex items-center justify-center gap-2 text-center text-4xl font-semibold sm:mb-16 md:mt-[10vh]"
        >
          {import.meta.env.VITE_APP_TITLE || 'ChatGPT Clone'}
        </h1>
        <div className="items-start gap-3.5 text-center md:flex">
          <div className="mb-8 flex flex-1 flex-col gap-3.5 md:mb-auto">
            <h2 className="m-auto flex items-center gap-3 text-lg font-normal md:flex-col md:gap-2">
              <SunIcon />
              Examples
            </h2>
            <ul className="m-auto flex w-full flex-col gap-3.5 sm:max-w-md">
              <button
                onClick={clickHandler}
                className="w-full rounded-md bg-gray-50 p-3 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-gray-900"
              >
                &quot;Search for REDD+ Projects in Indonesia&quot; →
              </button>
              <button
                onClick={clickHandler}
                className="w-full rounded-md bg-gray-50 p-3 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-gray-900"
              >
                &quot;Tell me more about Article 6 of the Paris Agreement&quot; →
              </button>
              <button
                onClick={clickHandler}
                className="w-full rounded-md bg-gray-50 p-3 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-gray-900"
              >
                &quot;What is the CAD Trust?&quot; →
              </button>
            </ul>
          </div>
          <div className="mb-8 flex flex-1 flex-col gap-3.5 md:mb-auto">
            <h2 className="m-auto flex items-center gap-3 text-lg font-normal md:flex-col md:gap-2">
              <LightningIcon />
              Capabilities
            </h2>
            <ul className="m-auto flex w-full flex-col gap-3.5 sm:max-w-md">
              <li className="w-full rounded-md bg-gray-50 p-3 dark:bg-white/5">
                Remembers what user said earlier in the conversation
              </li>
              <li className="w-full rounded-md bg-gray-50 p-3 dark:bg-white/5">
                Allows user to provide follow-up corrections
              </li>
              <li className="w-full rounded-md bg-gray-50 p-3 dark:bg-white/5">
                Trained to decline inappropriate requests
              </li>
            </ul>
          </div>
          <div className="mb-8 flex flex-1 flex-col gap-3.5 md:mb-auto">
            <h2 className="m-auto flex items-center gap-3 text-lg font-normal md:flex-col md:gap-2">
              <CautionIcon />
              Limitations
            </h2>
            <ul className="m-auto flex w-full flex-col gap-3.5 sm:max-w-md">
              <li className="w-full rounded-md bg-gray-50 p-3 dark:bg-white/5">
                May occasionally generate incorrect information
              </li>
              <li className="w-full rounded-md bg-gray-50 p-3 dark:bg-white/5">
                May occasionally produce harmful instructions or biased content
              </li>
              <li className="w-full rounded-md bg-gray-50 p-3 dark:bg-white/5">
                Limited knowledge of world events beyond carbon markets and climate change
              </li>
            </ul>
          </div>
        </div>
        {/* {!showingTemplates && (
          <div className="mt-8 mb-4 flex flex-col items-center gap-3.5 md:mt-16">
            <button
              onClick={showTemplates}
              className="btn btn-neutral justify-center gap-2 border-0 md:border"
            >
              <ChatIcon />
              Show Prompt Templates
            </button>
          </div>
        )}
        {!!showingTemplates && <Templates showTemplates={showTemplates}/>} 
        <div className="group h-32 w-full flex-shrink-0 dark:border-gray-900/50 dark:bg-gray-800 md:h-48" />*/}
      </div>
    </div>
  );
}
