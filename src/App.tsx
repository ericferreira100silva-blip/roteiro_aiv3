import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';

// --- Tipos ---
interface Dialogue {
  id: string;
  character: string;
  line: string;
}

interface Scene {
  id: string;
  content: string;
  dialogues: Dialogue[];
  listening?: boolean;
}

// Gera IDs únicos
const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 9);

// --- Componente da Fala ---
interface DialogueBoxProps {
  dialogue: Dialogue;
  sceneId: string;
  onDialogueChange: (sceneId: string, dialogueId: string, field: 'character' | 'line', value: string) => void;
  onDeleteDialogue: (sceneId: string, dialogueId: string) => void;
}

const DialogueBox: React.FC<DialogueBoxProps> = ({ dialogue, sceneId, onDialogueChange, onDeleteDialogue }) => (
  <div className="dialogue-box">
    <div className="dialogue-inputs-compact">
      <input
        type="text"
        className="dialogue-character-input"
        value={dialogue.character}
        onChange={(e) => onDialogueChange(sceneId, dialogue.id, 'character', e.target.value.toUpperCase())}
      />
      <textarea
        className="dialogue-line-input-compact"
        value={dialogue.line}
        onChange={(e) => onDialogueChange(sceneId, dialogue.id, 'line', e.target.value)}
      />
    </div>
    <button
      className="delete-dialogue-button"
      onClick={() => onDeleteDialogue(sceneId, dialogue.id)}
      title="Deletar Fala"
    >
      ×
    </button>
  </div>
);

// --- Componente da Cena ---
interface SceneBoxProps {
  scene: Scene;
  index: number;
  onContentChange: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  onAddDialogue: (sceneId: string) => void;
  onDialogueChange: (sceneId: string, dialogueId: string, field: 'character' | 'line', value: string) => void;
  onDeleteDialogue: (sceneId: string, dialogueId: string) => void;
  onStartRec: (sceneId: string) => void;
  onStopRec: (sceneId: string) => void;
}

const SceneBox: React.FC<SceneBoxProps> = ({
  scene,
  index,
  onContentChange,
  onDelete,
  onAddDialogue,
  onDialogueChange,
  onDeleteDialogue,
  onStartRec,
  onStopRec,
}) => {
  return (
    <div className="scene-box" data-scene-id={scene.id}>
      <header className="scene-header">
        <span className="scene-index">{index + 1}</span>
        <div className="scene-actions">
          {scene.listening ? (
            <button
              className="voice-button recording"
              onClick={() => onStopRec(scene.id)}
              title="Parar gravação"
            >
              ⏹
            </button>
          ) : (
            <button
              className="voice-button"
              onClick={() => onStartRec(scene.id)}
              title="Gravar cena"
            >
              🔴
            </button>
          )}

          <button
            className="add-dialogue-button"
            onClick={() => onAddDialogue(scene.id)}
            title="Adicionar Fala"
          >
            Fala
          </button>
          <button
            className="delete-button"
            onClick={() => onDelete(scene.id)}
            title="Deletar Cena"
          >
            ×
          </button>
        </div>
      </header>

      <textarea
        className="scene-textarea scene-action-input"
        value={scene.content}
        onChange={(e) => onContentChange(scene.id, e.target.value)}
      />

      <div className="dialogue-list">
        {scene.dialogues.map((dialogue) => (
          <DialogueBox
            key={dialogue.id}
            dialogue={dialogue}
            sceneId={scene.id}
            onDialogueChange={onDialogueChange}
            onDeleteDialogue={onDeleteDialogue}
          />
        ))}
      </div>
    </div>
  );
};

// --- Componente Principal ---
const App: React.FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [counter, setCounter] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'full' | 'scenes' | 'dialogues'>('full');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState<boolean>(false);
  const [translatedDialogues, setTranslatedDialogues] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeSceneRef = useRef<string | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);

  // 🔹 Carrega cenas do localStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('roteiro_scenes');
    if (saved) {
      try {
        setScenes(JSON.parse(saved));
      } catch {
        console.warn('Erro ao carregar cenas salvas');
      }
    }
  }, []);

  // 🔹 Salva cenas sempre que mudar
  useEffect(() => {
    localStorage.setItem('roteiro_scenes', JSON.stringify(scenes));
  }, [scenes]);

  // Adiciona cena
  const addScene = useCallback(() => {
    const newScene: Scene = { id: generateId(), content: '', dialogues: [] };
    setScenes((prev) => [...prev, newScene]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 0);
  }, []);

  const deleteScene = useCallback((id: string) => {
    if (activeSceneRef.current === id) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      activeSceneRef.current = null;
    }
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleContentChange = useCallback((id: string, newContent: string) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, content: newContent } : s)));
  }, []);

  const addDialogue = useCallback((sceneId: string) => {
    const newDialogue: Dialogue = { id: generateId(), character: '', line: '' };
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...s, dialogues: [...s.dialogues, newDialogue] } : s
      )
    );
  }, []);

  const deleteDialogue = useCallback((sceneId: string, dialogueId: string) => {
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...s, dialogues: s.dialogues.filter((d) => d.id !== dialogueId) } : s
      )
    );
  }, []);

  const handleDialogueChange = useCallback(
    (sceneId: string, dialogueId: string, field: 'character' | 'line', value: string) => {
      setScenes((prev) =>
        prev.map((s) => {
          if (s.id !== sceneId) return s;
          return {
            ...s,
            dialogues: s.dialogues.map((d) => (d.id === dialogueId ? { ...d, [field]: value } : d)),
          };
        })
      );
    },
    []
  );

  // Reconhecimento de voz
  const startRec = (sceneId: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Seu navegador não suporta SpeechRecognition');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      activeSceneRef.current = null;
    }

    const rec: SpeechRecognition = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalAppend = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalAppend += res[0].transcript;
        }
      }
      if (finalAppend.trim()) {
        setScenes((prev) =>
          prev.map((s) =>
            s.id === sceneId
              ? { ...s, content: (s.content ? s.content + ' ' : '') + finalAppend.trim() }
              : s
          )
        );
      }
    };

    rec.onend = () => {
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, listening: false } : s)));
      recognitionRef.current = null;
      activeSceneRef.current = null;
    };

    rec.onerror = () => {
      recognitionRef.current = null;
      activeSceneRef.current = null;
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, listening: false } : s)));
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      activeSceneRef.current = sceneId;
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, listening: true } : s)));
    } catch (err) {
      console.error('Erro ao iniciar reconhecimento:', err);
      alert('Não foi possível iniciar o reconhecimento. Tente novamente.');
    }
  };

  const stopRec = (sceneId: string) => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    activeSceneRef.current = null;
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, listening: false } : s)));
  };

  // Exporta texto
  const formatScenesForExport = () => {
    return scenes
      .map((scene, index) => {
        let script = '';
        if (scene.content.trim()) script += `${index + 1} - ${scene.content.trim()}\n`;
        else script += `${index + 1}\n`;

        scene.dialogues.forEach((d) => {
          if (d.character.trim()) script += `${d.character.trim().toUpperCase()}\n`;
          if (d.line.trim()) script += `- ${d.line.trim()}\n`;
        });

        script += '\n';
        return script;
      })
      .join('');
  };

  const formatScenesOnly = () => {
    return scenes
      .map((scene, index) => {
        if (scene.content.trim()) return `${index + 1} - ${scene.content.trim()}`;
        return `${index + 1}`;
      })
      .join('\n\n');
  };

  const formatDialoguesOnly = () => {
    return scenes
      .map((scene, index) => {
        let script = '';
        if (scene.dialogues.length > 0) {
          script += `${index + 1}\n`;
          scene.dialogues.forEach((d) => {
            if (d.character.trim()) script += `${d.character.trim().toUpperCase()}\n`;
            if (d.line.trim()) script += `- ${d.line.trim()}\n`;
          });
          script += '\n';
        }
        return script;
      })
      .filter(s => s.trim())
      .join('');
  };

  const translateToSpanish = async () => {
    setIsTranslating(true);
    try {
      const textToTranslate = formatDialoguesOnly();
      const response = await fetch('https://api.mymemory.translated.net/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `q=${encodeURIComponent(textToTranslate)}&langpair=pt|es`
      });
      const data = await response.json();

      if (data.responseData && data.responseData.translatedText) {
        setTranslatedDialogues(data.responseData.translatedText);
      } else {
        alert('Erro ao traduzir');
      }
    } catch (error) {
      console.error('Erro na tradução:', error);
      alert('Erro ao traduzir');
    } finally {
      setIsTranslating(false);
    }
  };

  // Atualiza cenas a partir do texto editado no roteiro final
  const handleFullScriptChange = (text: string) => {
    const lines = text.split('\n');
    const newScenes: Scene[] = [];
    let currentScene: Scene | null = null;

    lines.forEach((line) => {
      if (/^\d+/.test(line)) {
        if (currentScene) newScenes.push(currentScene);
        currentScene = { id: generateId(), content: '', dialogues: [] };

        const match = line.match(/^\d+\s*-\s*(.*)$/);
        if (match) currentScene.content = match[1];
      } else if (line.trim().toUpperCase() === line.trim() && line.trim() !== '' && !line.startsWith('-')) {
        if (currentScene) {
          currentScene.dialogues.push({ id: generateId(), character: line.trim(), line: '' });
        }
      } else if (line.trim().startsWith('-')) {
        if (currentScene && currentScene.dialogues.length > 0) {
          currentScene.dialogues[currentScene.dialogues.length - 1].line = line.replace('-', '').trim();
        }
      }
    });

    if (currentScene) newScenes.push(currentScene);
    setScenes(newScenes);
  };

  const handleCounterMouseDown = () => {
    isHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setCounter(1);
    }, 3000);
  };

  const handleCounterMouseUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isHoldingRef.current) {
      setCounter(prev => prev + 1);
    }

    isHoldingRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="app-layout">
      <div className={`left-panel ${leftPanelCollapsed ? 'collapsed' : ''}`}>
        <button
          className="toggle-panel-button"
          onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          title={leftPanelCollapsed ? 'Expandir' : 'Minimizar'}
        >
          {leftPanelCollapsed ? '›' : '‹'}
        </button>

        {!leftPanelCollapsed && (
          <div className="panel-content">
            <h2>Informação</h2>
            <div className="info-section">
              <p>Cenas: <strong>{scenes.length}</strong></p>
              <p>Falas: <strong>{scenes.reduce((sum, scene) => sum + scene.dialogues.length, 0)}</strong></p>
            </div>

            <div className="counter-section">
              <h3>Contador</h3>
              <button
                className="counter-button"
                onMouseDown={handleCounterMouseDown}
                onMouseUp={handleCounterMouseUp}
                onMouseLeave={handleCounterMouseUp}
              >
                <div className="counter-display">{counter}</div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="app-container">
        <h1>Roteiro</h1>

        <div className="scene-list">
        {scenes.map((scene, index) => (
          <SceneBox
            key={scene.id}
            scene={scene}
            index={index}
            onContentChange={handleContentChange}
            onDelete={deleteScene}
            onAddDialogue={addDialogue}
            onDialogueChange={handleDialogueChange}
            onDeleteDialogue={deleteDialogue}
            onStartRec={startRec}
            onStopRec={stopRec}
          />
        ))}
        <button className="add-scene-button" onClick={addScene}>
          +
        </button>
      </div>

      {scenes.length > 0 && (
        <div className="full-script-container">
          <div className="script-header">
            <h2>Roteiro Final</h2>
            <div className="script-tabs">
              <button
                className={`tab-button ${activeTab === 'full' ? 'active' : ''}`}
                onClick={() => setActiveTab('full')}
              >
                Completo
              </button>
              <button
                className={`tab-button ${activeTab === 'scenes' ? 'active' : ''}`}
                onClick={() => setActiveTab('scenes')}
              >
                Cenas
              </button>
              <button
                className={`tab-button ${activeTab === 'dialogues' ? 'active' : ''}`}
                onClick={() => setActiveTab('dialogues')}
              >
                Falas
              </button>
            </div>
          </div>

          {activeTab === 'full' && (
            <>
              <textarea
                className="full-script-textarea"
                value={formatScenesForExport()}
                rows={20}
                onChange={(e) => handleFullScriptChange(e.target.value)}
              />
              <button className="copy-button" onClick={() => navigator.clipboard.writeText(formatScenesForExport())}>
                Copiar
              </button>
            </>
          )}

          {activeTab === 'scenes' && (
            <>
              <textarea
                className="full-script-textarea"
                value={formatScenesOnly()}
                rows={20}
                readOnly
              />
              <button className="copy-button" onClick={() => navigator.clipboard.writeText(formatScenesOnly())}>
                Copiar
              </button>
            </>
          )}

          {activeTab === 'dialogues' && (
            <>
              <div className="dialogue-translation-section">
                <div className="translation-column">
                  <h3>Português</h3>
                  <textarea
                    className="full-script-textarea"
                    value={formatDialoguesOnly()}
                    rows={20}
                    readOnly
                  />
                  <button className="copy-button" onClick={() => navigator.clipboard.writeText(formatDialoguesOnly())}>
                    Copiar
                  </button>
                </div>

                <div className="translation-column">
                  <h3>Espanhol</h3>
                  <textarea
                    className="full-script-textarea"
                    value={translatedDialogues}
                    rows={20}
                    readOnly
                    placeholder="Clique em 'Traduzir' para gerar a versão em espanhol"
                  />
                  <div className="translation-buttons">
                    <button
                      className="translate-button"
                      onClick={translateToSpanish}
                      disabled={isTranslating || scenes.length === 0}
                    >
                      {isTranslating ? 'Traduzindo...' : 'Traduzir'}
                    </button>
                    {translatedDialogues && (
                      <button className="copy-button" onClick={() => navigator.clipboard.writeText(translatedDialogues)}>
                        Copiar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default App;
