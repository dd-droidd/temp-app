import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class AppErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, message: string}> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || '알 수 없는 오류가 발생했습니다.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:'#f8fafc',fontFamily:'Arial,"Noto Sans KR",sans-serif'}}>
          <div style={{maxWidth:620,width:'100%',background:'#fff',borderRadius:28,padding:32,boxShadow:'0 20px 60px rgba(0,0,0,.12)',textAlign:'center'}}>
            <div style={{fontSize:52}}>⚠️</div>
            <h1 style={{fontSize:28,fontWeight:900,color:'#1e293b'}}>프로그램을 불러오지 못했습니다.</h1>
            <p style={{marginTop:12,color:'#64748b',fontWeight:700,lineHeight:1.6}}>
              아래 오류를 확인한 뒤 수정할 수 있습니다.
            </p>
            <pre style={{marginTop:20,whiteSpace:'pre-wrap',textAlign:'left',background:'#f8fafc',padding:16,borderRadius:16,color:'#be123c',fontSize:13}}>{this.state.message}</pre>
            <button
              onClick={() => window.location.reload()}
              style={{marginTop:20,border:0,borderRadius:999,padding:'14px 24px',background:'#4f46e5',color:'#fff',fontWeight:900,fontSize:16,cursor:'pointer'}}
            >
              다시 불러오기
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
)
