'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, FuelRecord, TollRecord } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Home() {
  // ✅ Auth 상태
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const router = useRouter()

  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([])
  const [tollRecords, setTollRecords] = useState<TollRecord[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [memo, setMemo] = useState('- 시동 off\n- 총 주행거리 기록 및 리셋 / 말일 작성\n- 차량 시스템 연비 기록')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [loading, setLoading] = useState(true)
  const [isMemoEditing, setIsMemoEditing] = useState(false)
  const [isBudgetEditing, setIsBudgetEditing] = useState(false)
  const [tempMemo, setTempMemo] = useState('')
  const [tempBudget, setTempBudget] = useState(0)
  
  const [editingFuelId, setEditingFuelId] = useState<string | null>(null)
  const [editingTollId, setEditingTollId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    region: '',
    station: '',
    pricePerLiter: '',
    fuelAmount: '',
    distance: ''
  })

  const [tollForm, setTollForm] = useState({
    date: new Date().toISOString().split('T')[0],
    section: '',
    amount: ''
  })

  // ✅ Auth 체크
  useEffect(() => {
    checkUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.push('/auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setAuthLoading(false)
    
    if (!user) {
      router.push('/auth')
    }
  }

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [currentYear, currentMonth, user])

  // ✅ user_id 필터 추가
  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
      
      const { data: fuelData } = await supabase
        .from('fuel_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('time', { ascending: false })

      const { data: tollData } = await supabase
        .from('toll_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
      const { data: budgetData } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('key', 'budget')
        .eq('year_month', yearMonth)
        .single()

      const { data: memoData } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('key', 'memo')
        .eq('year_month', '')
        .single()

      setFuelRecords(fuelData || [])
      setTollRecords(tollData || [])
      setMonthlyBudget(budgetData?.value ? parseInt(budgetData.value) : 0)
      setMemo(memoData?.value || memo)
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  // ✅ user_id 추가
  const handleAddFuel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const totalCost = Math.round(parseFloat(formData.pricePerLiter) * parseFloat(formData.fuelAmount))
    
    const { data, error } = await supabase
      .from('fuel_records')
      .insert([{
        user_id: user.id,
        date: formData.date,
        time: currentTime,
        region: formData.region,
        station: formData.station,
        price_per_liter: parseInt(formData.pricePerLiter),
        fuel_amount: parseFloat(formData.fuelAmount),
        distance: parseInt(formData.distance),
        total_cost: totalCost
      }])
      .select()

    if (!error && data) {
      setFuelRecords([data[0], ...fuelRecords])
      showToast('주유 기록이 추가되었습니다!')
      setFormData({
        ...formData,
        region: '',
        station: '',
        pricePerLiter: '',
        fuelAmount: '',
        distance: ''
      })
    } else {
      showToast('저장에 실패했습니다', 'error')
    }
  }

  const startEditFuel = (record: FuelRecord) => {
    setEditingFuelId(record.id)
    setOpenMenuId(null)
  }

  // ✅ user_id 확인 추가
  const handleUpdateFuel = async (record: FuelRecord) => {
    if (!user) return
    
    const totalCost = Math.round(record.price_per_liter * record.fuel_amount)

    const { error } = await supabase
      .from('fuel_records')
      .update({
        date: record.date,
        time: record.time,
        region: record.region,
        station: record.station,
        price_per_liter: record.price_per_liter,
        fuel_amount: record.fuel_amount,
        distance: record.distance,
        total_cost: totalCost
      })
      .eq('id', record.id)
      .eq('user_id', user.id)

    if (!error) {
      setEditingFuelId(null)
      await loadData()
      showToast('수정되었습니다!')
    } else {
      showToast('수정에 실패했습니다', 'error')
    }
  }

  const cancelEditFuel = () => {
    setEditingFuelId(null)
    loadData()
  }

  // ✅ user_id 확인 추가
  const handleDeleteFuel = async (id: string) => {
    if (!user) return
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    const { error } = await supabase
      .from('fuel_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setFuelRecords(fuelRecords.filter(r => r.id !== id))
      showToast('삭제되었습니다!')
    } else {
      showToast('삭제에 실패했습니다', 'error')
    }
    setOpenMenuId(null)
  }

  // ✅ user_id 추가
  const handleAddToll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    const { data, error } = await supabase
      .from('toll_records')
      .insert([{
        user_id: user.id,
        date: tollForm.date,
        section: tollForm.section || '톨게이트',
        amount: parseInt(tollForm.amount)
      }])
      .select()

    if (!error && data) {
      setTollRecords([data[0], ...tollRecords])
      showToast('톨게이트 기록이 추가되었습니다!')
      setTollForm({
        ...tollForm,
        section: '',
        amount: ''
      })
    } else {
      showToast('저장에 실패했습니다', 'error')
    }
  }

  const startEditToll = (record: TollRecord) => {
    setEditingTollId(record.id)
    setOpenMenuId(null)
  }

  // ✅ user_id 확인 추가
  const handleUpdateToll = async (record: TollRecord) => {
    if (!user) return
    
    const { error } = await supabase
      .from('toll_records')
      .update({
        date: record.date,
        section: record.section,
        amount: record.amount
      })
      .eq('id', record.id)
      .eq('user_id', user.id)

    if (!error) {
      setEditingTollId(null)
      await loadData()
      showToast('수정되었습니다!')
    } else {
      showToast('수정에 실패했습니다', 'error')
    }
  }

  const cancelEditToll = () => {
    setEditingTollId(null)
    loadData()
  }

  // ✅ user_id 확인 추가
  const handleDeleteToll = async (id: string) => {
    if (!user) return
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    const { error } = await supabase
      .from('toll_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setTollRecords(tollRecords.filter(r => r.id !== id))
      showToast('삭제되었습니다!')
    } else {
      showToast('삭제에 실패했습니다', 'error')
    }
    setOpenMenuId(null)
  }

  // ✅ user_id 추가
  const handleSaveBudget = async () => {
    if (!user) return
    
    const yearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    
    const { error } = await supabase
      .from('settings')
      .upsert({
        user_id: user.id,
        key: 'budget',
        value: tempBudget.toString(),
        year_month: yearMonth
      }, {
        onConflict: 'key,year_month,user_id'
      })

    if (!error) {
      setMonthlyBudget(tempBudget)
      setIsBudgetEditing(false)
      showToast('예산이 저장되었습니다!')
    }
  }

  // ✅ user_id 추가
  const handleSaveMemo = async () => {
    if (!user) return
    
    const { error } = await supabase
      .from('settings')
      .upsert({
        user_id: user.id,
        key: 'memo',
        value: tempMemo,
        year_month: ''
      }, {
        onConflict: 'key,year_month,user_id'
      })

    if (!error) {
      setMemo(tempMemo)
      setIsMemoEditing(false)
      showToast('메모가 저장되었습니다!')
    }
  }

  // ✅ 로그아웃 기능 추가
  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div')
    toast.className = `fixed bottom-8 right-8 bg-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-slide-in ${type === 'error' ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`
    toast.innerHTML = `
      <span class="text-2xl">${type === 'success' ? '✓' : '✕'}</span>
      <span class="font-semibold text-gray-800">${message}</span>
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  const calculateStats = () => {
    const monthlyFuelCost = fuelRecords.reduce((sum, r) => sum + r.total_cost, 0)
    const monthlyTollCost = tollRecords.reduce((sum, r) => sum + r.amount, 0)
    const totalFuel = fuelRecords.reduce((sum, r) => sum + r.fuel_amount, 0)
    const totalDistance = fuelRecords.reduce((sum, r) => sum + r.distance, 0)

    const sortedRecords = [...fuelRecords].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return (a.time || '').localeCompare(b.time || '')
    })

    let totalEfficiency = 0
    let count = 0
    for (let i = 1; i < sortedRecords.length; i++) {
      const distance = sortedRecords[i].distance
      const prevFuel = sortedRecords[i - 1].fuel_amount
      if (distance > 0 && prevFuel > 0) {
        totalEfficiency += distance / prevFuel
        count++
      }
    }

    const avgEfficiency = count > 0 ? (totalEfficiency / count).toFixed(2) : '0'
    const remaining = monthlyBudget - monthlyFuelCost - monthlyTollCost
    const usedPercent = monthlyBudget > 0 ? Math.min((monthlyFuelCost + monthlyTollCost) / monthlyBudget * 100, 100) : 0

    return {
      monthlyFuelCost,
      monthlyTollCost,
      totalFuel,
      totalDistance,
      avgEfficiency,
      remaining,
      usedPercent
    }
  }

  const stats = calculateStats()

  const changeMonth = (direction: number) => {
    if (direction === 0) {
      setCurrentYear(new Date().getFullYear())
      setCurrentMonth(new Date().getMonth())
    } else {
      let newMonth = currentMonth + direction
      let newYear = currentYear
      if (newMonth > 11) {
        newMonth = 0
        newYear++
      } else if (newMonth < 0) {
        newMonth = 11
        newYear--
      }
      setCurrentYear(newYear)
      setCurrentMonth(newMonth)
    }
  }

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  // ✅ Auth 로딩 화면
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">로그인 확인 중...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-12 mb-[-60px]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-4xl font-bold">⛽️ 주유 관리</h1>
          <button 
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-semibold transition"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 flex justify-between items-center">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-primary">{currentYear}</span>
            <span className="text-3xl font-bold text-gray-900">{monthNames[currentMonth]}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition">◀</button>
            <button onClick={() => changeMonth(0)} className="px-4 py-2 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition">오늘</button>
            <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition">▶</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-900">⚠️ 주유 시 중요 사항</h3>
            <button onClick={() => { setIsMemoEditing(!isMemoEditing); setTempMemo(memo) }} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <div className="flex flex-col gap-0.5">
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
              </div>
            </button>
          </div>
          {!isMemoEditing ? (
            <p className="text-gray-700 text-sm whitespace-pre-line">{memo}</p>
          ) : (
            <div>
              <textarea value={tempMemo} onChange={(e) => setTempMemo(e.target.value)} className="w-full p-3 border rounded-lg text-sm" rows={4} maxLength={1000} />
              <div className="flex gap-2 mt-3">
                <button onClick={handleSaveMemo} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition">저장</button>
                <button onClick={() => setIsMemoEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">취소</button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
            <h3 className="text-xs text-gray-500 font-semibold mb-2">이번 달 주유비</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">{stats.monthlyFuelCost.toLocaleString()}</p>
            <p className="text-sm text-gray-400">원</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
            <h3 className="text-xs text-gray-500 font-semibold mb-2">평균 연비</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">{stats.avgEfficiency}</p>
            <p className="text-sm text-gray-400">km/L</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
            <h3 className="text-xs text-gray-500 font-semibold mb-2">주행거리</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalDistance.toLocaleString()}</p>
            <p className="text-sm text-gray-400">km</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
            <h3 className="text-xs text-gray-500 font-semibold mb-2">주유량</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalFuel.toFixed(1)}</p>
            <p className="text-sm text-gray-400">L</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">주유 기록 추가</h2>

            <div className="bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl p-5 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold opacity-90">월 예산</h3>
                <button onClick={() => { setIsBudgetEditing(!isBudgetEditing); setTempBudget(monthlyBudget) }} className="bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 transition">
                  <div className="flex gap-0.5">
                    <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                    <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                    <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                  </div>
                </button>
              </div>
              {!isBudgetEditing ? (
                <>
                  <p className="text-2xl font-bold mb-1">{monthlyBudget.toLocaleString()}원</p>
                  {monthlyBudget > 0 && (
                    <>
                      <p className="text-sm opacity-95 mb-3">잔액 {stats.remaining.toLocaleString()}원</p>
                      <div className="bg-white/25 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${stats.usedPercent > 100 ? 'bg-red-400' : stats.usedPercent > 80 ? 'bg-yellow-400' : 'bg-white'}`} style={{ width: `${Math.min(stats.usedPercent, 100)}%` }}></div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex gap-2">
                  <input type="number" value={tempBudget} onChange={(e) => setTempBudget(parseInt(e.target.value))} className="flex-1 px-3 py-2 rounded-lg text-gray-900 font-bold" min="0" />
                  <button onClick={handleSaveBudget} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition">저장</button>
                  <button onClick={() => setIsBudgetEditing(false)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition">취소</button>
                </div>
              )}
            </div>

            <form onSubmit={handleAddFuel} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">날짜</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">지역</label>
                <input type="text" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} placeholder="예: 서울" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" maxLength={20} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">주유소 상호명</label>
                <input type="text" value={formData.station} onChange={(e) => setFormData({ ...formData, station: e.target.value })} placeholder="예: SK 가스충전소" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" maxLength={50} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">단가 <span className="text-gray-400 font-normal">(원/L)</span></label>
                <input type="number" value={formData.pricePerLiter} onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })} placeholder="예: 1600" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">주유량 <span className="text-gray-400 font-normal">(L)</span></label>
                <input type="number" step="0.1" value={formData.fuelAmount} onChange={(e) => setFormData({ ...formData, fuelAmount: e.target.value })} placeholder="예: 40.5" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">주행거리 <span className="text-gray-400 font-normal">(이전 주유일자부터 당일 주유일까지의 총 주행거리, km)</span></label>
                <input type="number" value={formData.distance} onChange={(e) => setFormData({ ...formData, distance: e.target.value })} placeholder="예: 350" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" required min="0" />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-[1.02] active:scale-100">
                기록 추가
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">주유 기록</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {fuelRecords.length === 0 ? (
                <p className="text-center text-gray-400 py-12">이번 달 기록이 없습니다</p>
              ) : (
                fuelRecords.map((record) => (
                  <div key={record.id}>
                    {editingFuelId === record.id ? (
                      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">날짜</label>
                          <input type="date" value={record.date} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, date: e.target.value } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">시간</label>
                          <input type="time" value={record.time || ''} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, time: e.target.value } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">지역</label>
                            <input type="text" value={record.region || ''} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, region: e.target.value } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={20} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">주유소</label>
                            <input type="text" value={record.station || ''} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, station: e.target.value } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={50} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">단가</label>
                            <input type="number" value={record.price_per_liter} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, price_per_liter: parseInt(e.target.value) } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" min="0" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">주유량</label>
                            <input type="number" step="0.1" value={record.fuel_amount} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, fuel_amount: parseFloat(e.target.value) } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" min="0" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">거리</label>
                            <input type="number" value={record.distance} onChange={(e) => { const updated = fuelRecords.map(r => r.id === record.id ? { ...r, distance: parseInt(e.target.value) } : r); setFuelRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" min="0" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => handleUpdateFuel(record)} className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition">저장</button>
                          <button onClick={cancelEditFuel} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-2 px-4 rounded-lg transition">취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-5 hover:bg-gray-100 transition relative">
                        <div className="absolute top-3 right-3">
                          <button onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)} className="text-gray-500 hover:text-gray-700 text-xl leading-none px-2 py-1">⋮</button>
                          {openMenuId === record.id && (
                            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[100px]">
                              <button onClick={() => startEditFuel(record)} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-semibold text-gray-700 rounded-t-lg">수정</button>
                              <button onClick={() => handleDeleteFuel(record.id)} className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm font-semibold text-red-600 rounded-b-lg">삭제</button>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-900">{record.date} {record.region && `(${record.region})`}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{record.time}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{record.station || '주유소'}<br />주유량: {record.fuel_amount}L | 단가: {record.price_per_liter.toLocaleString()}원/L | 주행: {record.distance}km</p>
                        <p className="text-2xl font-bold text-primary">{record.total_cost.toLocaleString()}원</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">톨게이트 요금</h2>
          <form onSubmit={handleAddToll} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">날짜</label>
              <input type="date" value={tollForm.date} onChange={(e) => setTollForm({ ...tollForm, date: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">구간</label>
              <input type="text" value={tollForm.section} onChange={(e) => setTollForm({ ...tollForm, section: e.target.value })} placeholder="예: 서울-부산" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" maxLength={50} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">요금 <span className="text-gray-400 font-normal">(원)</span></label>
              <input type="number" value={tollForm.amount} onChange={(e) => setTollForm({ ...tollForm, amount: e.target.value })} placeholder="예: 35000" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent" required min="0" />
            </div>
            <button type="submit" className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-xl transition self-end">추가</button>
          </form>

          <div className="space-y-3 mb-6">
            {tollRecords.length === 0 ? (
              <p className="text-center text-gray-400 py-8">이번 달 톨게이트 기록이 없습니다</p>
            ) : (
              tollRecords.map((record) => (
                <div key={record.id}>
                  {editingTollId === record.id ? (
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">날짜</label>
                        <input type="date" value={record.date} onChange={(e) => { const updated = tollRecords.map(r => r.id === record.id ? { ...r, date: e.target.value } : r); setTollRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">구간</label>
                        <input type="text" value={record.section || ''} onChange={(e) => { const updated = tollRecords.map(r => r.id === record.id ? { ...r, section: e.target.value } : r); setTollRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={50} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">요금</label>
                        <input type="number" value={record.amount} onChange={(e) => { const updated = tollRecords.map(r => r.id === record.id ? { ...r, amount: parseInt(e.target.value) } : r); setTollRecords(updated) }} className="w-full px-3 py-2 border rounded-lg text-sm" min="0" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleUpdateToll(record)} className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition">저장</button>
                        <button onClick={cancelEditToll} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-2 px-4 rounded-lg transition">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition relative">
                      <div className="absolute top-3 right-3">
                        <button onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)} className="text-gray-500 hover:text-gray-700 text-xl leading-none px-2 py-1">⋮</button>
                        {openMenuId === record.id && (
                          <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[100px]">
                            <button onClick={() => startEditToll(record)} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-semibold text-gray-700 rounded-t-lg">수정</button>
                            <button onClick={() => handleDeleteToll(record.id)} className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm font-semibold text-red-600 rounded-b-lg">삭제</button>
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 mb-1">{record.date}</p>
                      <p className="text-sm text-gray-600 mb-2">{record.section}</p>
                      <p className="text-xl font-bold text-primary">{record.amount.toLocaleString()}원</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <p className="text-sm font-semibold text-gray-600 mb-2">총 톨게이트 요금</p>
            <p className="text-3xl font-bold text-primary">{stats.monthlyTollCost.toLocaleString()}원</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease;
        }
      `}</style>
    </div>
  )
}
