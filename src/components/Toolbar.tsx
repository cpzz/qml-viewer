import React from 'react'
import { PanelRightOpen, PanelLeftOpen, FilePlus, FolderOpen, Save, Sun, Moon, Languages, Globe } from 'lucide-react'
import { useI18n } from '../i18n'

interface ToolbarProps {
  isLight: boolean
  onToggleTheme: () => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  hasChanges: boolean
  showFileList: boolean
  onToggleFileList: () => void
}

export default function Toolbar({ isLight, onToggleTheme, onNew, onOpen, onSave, hasChanges, showFileList, onToggleFileList }: ToolbarProps) {
  const { t, locale, toggleLocale } = useI18n()

  return (
    <div className="toolbar">
      <button className="tool-btn" onClick={onToggleFileList} title={showFileList ? 'Hide file list' : 'Show file list'}>
        {showFileList ? <PanelLeftOpen size={18} /> : <PanelRightOpen size={18} />}
      </button>
      <div className="toolbar-separator" />
      <button className="tool-btn" onClick={onNew} title={t('toolbar.new')}>
        <FilePlus size={18} />
      </button>
      <button className="tool-btn" onClick={onOpen} title={t('toolbar.open')}>
        <FolderOpen size={18} />
      </button>
      <button className="tool-btn" onClick={onSave} title={t('toolbar.save')} disabled={!hasChanges}>
        <Save size={18} />
      </button>
      <div className="toolbar-spacer" />
      <button className="tool-btn" onClick={onToggleTheme} title={t('toolbar.theme')}>
        {isLight ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <button className="tool-btn" onClick={toggleLocale} title={t('toolbar.language')}>
        {locale === 'zh-CN' ? <Languages size={18} /> : <Globe size={18} />}
      </button>
    </div>
  )
}
