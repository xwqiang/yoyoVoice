import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Child, CustomList, Word } from '../../types'

export function WordsPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [lists, setLists] = useState<CustomList[]>([])
  const [selectedList, setSelectedList] = useState<number | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [listName, setListName] = useState('')
  const [importText, setImportText] = useState('')
  const [previewWords, setPreviewWords] = useState<{ word_en: string; meaning_zh: string; phonetic?: string }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSource, setImportSource] = useState('')
  const [manualWord, setManualWord] = useState({ word_en: '', meaning_zh: '', phonetic: '' })
  const [error, setError] = useState('')
  const listLoadSeq = useRef(0)
  const wordsLoadSeq = useRef(0)

  useEffect(() => {
    api.children.list()
      .then((list) => {
        setChildren(list)
        if (list[0]) setSelectedChild(list[0].id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    setLists([])
    setSelectedList(null)
    setWords([])
    setPreviewWords([])
    setImportError('')
    const seq = ++listLoadSeq.current
    api.customLists.list(selectedChild)
      .then((l) => {
        if (seq !== listLoadSeq.current) return
        setLists(l)
        if (l[0]) setSelectedList(l[0].id)
      })
      .catch((err) => {
        if (seq !== listLoadSeq.current) return
        setError(err instanceof Error ? err.message : '加载词表失败')
      })
  }, [selectedChild])

  useEffect(() => {
    if (!selectedList) {
      setWords([])
      return
    }
    const seq = ++wordsLoadSeq.current
    api.customLists.words(selectedList)
      .then((w) => {
        if (seq !== wordsLoadSeq.current) return
        setWords(w)
      })
      .catch((err) => {
        if (seq !== wordsLoadSeq.current) return
        setError(err instanceof Error ? err.message : '加载单词失败')
      })
  }, [selectedList])

  const handleCreateList = async () => {
    if (!selectedChild || !listName.trim()) return
    setError('')
    try {
      const list = await api.customLists.create({ child_id: selectedChild, name: listName })
      setListName('')
      setLists((prev) => [...prev, { ...list, word_count: 0 }])
      setSelectedList(list.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建词表失败')
    }
  }

  const handlePreviewImport = async () => {
    if (!importText.trim()) {
      setImportError('请先粘贴或输入要解析的单词')
      setPreviewWords([])
      return
    }
    setImportLoading(true)
    setImportError('')
    setImportSource('')
    setPreviewWords([])
    try {
      const res = await api.ai.importWords(importText)
      setPreviewWords(res.words)
      setImportSource(res.source === 'ai' ? 'AI 识别（含释义音标）' : '本地拆分')
      if (res.words.length === 0) {
        setImportError('未能识别单词。试试每行一个，或用顿号/逗号分隔：apple、dog、cat')
      } else if (res.source !== 'ai' && res.words.every((w) => !w.meaning_zh)) {
        setImportError('已识别单词，可直接保存。如需自动补充释义，请配置 CURSOR_API_KEY 或 OPENAI_API_KEY')
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '解析失败，请稍后重试')
    } finally {
      setImportLoading(false)
    }
  }

  const handleSaveImport = async () => {
    if (!selectedList) return
    const created = await api.words.bulk(previewWords)
    for (const w of created) {
      await api.customLists.addWord(selectedList, w.id)
    }
    setPreviewWords([])
    setImportText('')
    api.customLists.words(selectedList).then(setWords)
    api.customLists.list(selectedChild!).then(setLists)
  }

  const handleAddManual = async () => {
    if (!selectedList || !manualWord.word_en.trim()) return
    const word = await api.words.create(manualWord)
    await api.customLists.addWord(selectedList, word.id)
    setManualWord({ word_en: '', meaning_zh: '', phonetic: '' })
    api.customLists.words(selectedList).then(setWords)
    api.customLists.list(selectedChild!).then(setLists)
  }

  const handleRemoveWord = async (wordId: number) => {
    if (!selectedList) return
    await api.customLists.removeWord(selectedList, wordId)
    api.customLists.words(selectedList).then(setWords)
    api.customLists.list(selectedChild!).then(setLists)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">自定义词表</h2>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedChild(c.id)}
            className={`px-4 py-2 rounded-xl font-medium ${
              selectedChild === c.id ? 'bg-indigo-600 text-white' : 'bg-white border'
            }`}
          >
            {c.avatar_emoji} {c.nickname}
          </button>
        ))}
      </div>

      {selectedChild && (
        <>
          <Card>
            <h3 className="font-bold mb-3">创建词表</h3>
            <div className="flex gap-2">
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="词表名称，如：本周生词"
                className="flex-1 px-4 py-3 rounded-xl border"
              />
              <Button onClick={handleCreateList}>创建</Button>
            </div>
          </Card>

          <div className="flex gap-2 flex-wrap">
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedList(l.id)}
                className={`px-4 py-2 rounded-xl ${
                  selectedList === l.id ? 'bg-emerald-600 text-white' : 'bg-slate-100'
                }`}
              >
                {l.name} ({l.word_count})
              </button>
            ))}
          </div>

          {selectedList && (
            <>
              <Card>
                <h3 className="font-bold mb-3">AI 快速录入</h3>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"每行一个，或用顿号/逗号分隔，中文可选：\napple、dog、cat\napple 苹果\ncat"}
                  className="w-full px-4 py-3 rounded-xl border h-32 text-base"
                />
                <div className="flex gap-2 mt-2 flex-wrap items-center">
                  <Button variant="secondary" onClick={handlePreviewImport} disabled={importLoading}>
                    {importLoading ? 'AI 补全释义和音标中...' : 'AI 解析预览'}
                  </Button>
                  {previewWords.length > 0 && (
                    <Button onClick={handleSaveImport}>确认导入 ({previewWords.length})</Button>
                  )}
                  {importSource && (
                    <span className="text-sm text-slate-500">解析方式：{importSource}</span>
                  )}
                </div>
                {importError && <p className="text-red-500 text-sm mt-2">{importError}</p>}
                {previewWords.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {previewWords.map((w, i) => (
                      <p key={i} className="text-sm text-slate-700 py-1 border-b border-slate-100">
                        <span className="font-semibold text-indigo-600">{w.word_en}</span>
                        {w.phonetic && <span className="text-slate-400 ml-2">{w.phonetic}</span>}
                        <span className="ml-2">{w.meaning_zh || '（待补全释义）'}</span>
                      </p>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="font-bold mb-3">手动添加</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={manualWord.word_en}
                    onChange={(e) => setManualWord({ ...manualWord, word_en: e.target.value })}
                    placeholder="英文"
                    className="px-4 py-3 rounded-xl border"
                  />
                  <input
                    value={manualWord.meaning_zh}
                    onChange={(e) => setManualWord({ ...manualWord, meaning_zh: e.target.value })}
                    placeholder="中文释义（可选）"
                    className="px-4 py-3 rounded-xl border"
                  />
                  <input
                    value={manualWord.phonetic}
                    onChange={(e) => setManualWord({ ...manualWord, phonetic: e.target.value })}
                    placeholder="音标（可选）"
                    className="px-4 py-3 rounded-xl border"
                  />
                </div>
                <Button className="mt-2" onClick={handleAddManual}>添加单词</Button>
              </Card>

              <Card>
                <h3 className="font-bold mb-3">词表内容 ({words.length})</h3>
                <div className="space-y-2">
                  {words.map((w) => (
                    <div key={w.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <div>
                        <span className="font-medium">{w.word_en}</span>
                        <span className="text-slate-500 ml-2">{w.meaning_zh}</span>
                        {w.phonetic && <span className="text-sm text-slate-400 ml-2">{w.phonetic}</span>}
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleRemoveWord(w.id)}>移除</Button>
                    </div>
                  ))}
                  {words.length === 0 && <p className="text-slate-400 text-center py-4">词表为空</p>}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
