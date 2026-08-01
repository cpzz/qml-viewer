import React from 'react'
import { PanelRightOpen, PanelLeftOpen, FilePlus, File, FolderOpen, Save, RefreshCw, ScanEye, Scan, Eye, EyeOff, Sun, Moon, Languages, Globe, Captions, CaptionsOff, Palette, TextInitial } from 'lucide-react'
import { useI18n } from '../i18n'
import { qmlControlStyles, type QmlControlStyle } from '../runtime/QmlControlStyle'

interface ToolbarProps {
  isLight: boolean
  onToggleTheme: () => void
  qmlControlStyle: QmlControlStyle
  onQmlControlStyleChange: (style: QmlControlStyle) => void
  onNew: () => void
  onOpenFiles: () => void
  onOpenDirectory: () => void
  onSave: () => void
  onRefresh: () => void
  onFormat: () => void
  hasChanges: boolean
  canRefresh: boolean
  showFileList: boolean
  onToggleFileList: () => void
  showEditor: boolean
  onToggleEditor: () => void
  showPreview: boolean
  onTogglePreview: () => void
  showLogPanel: boolean
  onToggleLogPanel: () => void
}

export default function Toolbar({ isLight, onToggleTheme, qmlControlStyle, onQmlControlStyleChange, onNew, onOpenFiles, onOpenDirectory, onSave, onRefresh, onFormat, hasChanges, canRefresh, showFileList, onToggleFileList, showEditor, onToggleEditor, showPreview, onTogglePreview, showLogPanel, onToggleLogPanel }: ToolbarProps) {
  const { t, locale, toggleLocale } = useI18n()

  return (
    <div className="toolbar">
      <button className="tool-btn" onClick={onToggleFileList} title={t(showFileList ? 'toolbar.hideFileList' : 'toolbar.showFileList')}>
        {showFileList ? <PanelRightOpen size={18} /> : <PanelLeftOpen size={18} />}
      </button>
      <div className="toolbar-separator" />
      <button className="tool-btn" onClick={onNew} title={t('toolbar.new')}>
        <File size={18} />
      </button>
      <button className="tool-btn" onClick={onOpenFiles} title={t('toolbar.openFile')}>
        <FilePlus size={18} />
      </button>
      <button className="tool-btn" onClick={onOpenDirectory} title={t('toolbar.openDirectory')}>
        <FolderOpen size={18} />
      </button>
      <button className="tool-btn" onClick={onSave} title={t('toolbar.save')} disabled={!hasChanges}>
        <Save size={18} />
      </button>
      <button className="tool-btn" onClick={onRefresh} title={t('toolbar.refresh')} disabled={!canRefresh}>
        <RefreshCw size={18} />
      </button>
      <div className="toolbar-separator" />
      <button className="tool-btn" onClick={onToggleEditor} title={t(showEditor ? 'toolbar.hideEditor' : 'toolbar.showEditor')}>
        {showEditor ? <Scan size={18} /> : <ScanEye size={18} />}
      </button>
      <button className="tool-btn" onClick={onTogglePreview} title={t(showPreview ? 'toolbar.hidePreview' : 'toolbar.showPreview')}>
        {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <button className="tool-btn" onClick={onToggleLogPanel} title={t(showLogPanel ? 'toolbar.hideLogPanel' : 'toolbar.showLogPanel')}>
        {showLogPanel ? <CaptionsOff size={18} /> : <Captions size={18} />}
      </button>
      <div className="toolbar-separator" />
      <button className="tool-btn" onClick={onFormat} title={t('toolbar.format')}>
        <TextInitial size={18} />
      </button>
      <div className="toolbar-spacer" />
      <label className="qml-style-picker" title={t('toolbar.controlStyle')}>
        <Palette size={16} aria-hidden="true" />
        <select
          aria-label={t('toolbar.controlStyle')}
          value={qmlControlStyle}
          onChange={event => onQmlControlStyleChange(event.target.value as QmlControlStyle)}
        >
          {qmlControlStyles.map(style => <option key={style} value={style}>{style}</option>)}
        </select>
      </label>
      <button className="tool-btn" onClick={onToggleTheme} title={t('toolbar.theme')}>
        {isLight ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <button className="tool-btn" onClick={toggleLocale} title={t('toolbar.language')}>
        {locale === 'zh-CN' ? <Languages size={18} /> : <Globe size={18} />}
      </button>
    </div>
  )
}
