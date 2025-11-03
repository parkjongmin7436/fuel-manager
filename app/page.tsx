'use client'

import { useEffect, useState } from 'react'
import { supabase, FuelRecord, TollRecord } from '@/lib/supabase'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'fuel' | 'toll'>('fuel')
  const [currentMonth, setCurrentMonth] = useState('')
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([])
  const [tollRecords, setTollRecords] = useState<TollRecord[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [memo, setMemo] = useState('')
  const [editingBudget, setEditingBudget] = useState(false)
  const [editingMemo, setEditingMemo] = useState(false)
  
  // 수정 중인 레코드 ID 추적
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  
  // 메뉴 열림 상태 추적
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // 주유 기록 폼 데이터
  const [fuelForm, setFuelForm] = useState({
    date: '',
    region: '',
    station: '',
    price_per_liter: '',
    fuel_amount: '',
    distance: '',
  })

  // 톨게이트 폼 데이터
  const [tollForm, setTollForm] = useState({
    date: '',
    section: '',
    amount: '',
  })

  useEffect(() => {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(yearMonth)
    fetchRecords(yearMonth)
    fetchSettings(yearMonth)
  }, [])

  const fetchRecords = async (yearMonth: string) => {
    const [year, month] = yearMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = `${year}-${month}-31`

    const { data: fuelData } = await supabase
      .from('fuel_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    const { data: tollData } = await supabase
      .from('toll_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (fuelData) setFuelRecords(fuelData)
    if (tollData) setTollRecords(tollData)
  }

  const fetchSettings = async (yearMonth: string) => {
    const { data: budgetData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'monthly_budget')
      .eq('year_month', yearMonth)
      .single()

    const { data: memoData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'memo')
      .eq('year_month', '')
      .single()

    if (budgetData) setMonthlyBudget(Number(budgetData.value))
    if (memoData) setMemo(memoData.value)
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMonth = e.target.value
    setCurrentMonth(newMonth)
    fetchRecords(newMonth)
    fetchSettings(newMonth)
  }

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 시간 자동 저장
    const now = new Date()
    const currentTime = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

    const total_cost = Number(fuelForm.price_per_liter) * Number(fuelForm.fuel_amount)

    const { error } = await supabase.from('fuel_records').insert([
      {
        date: fuelForm.date,
        time: currentTime, // 자동 저장된 시간
        region: fuelForm.region,
        station: fuelForm.station,
        price_per_liter: Number(fuelForm.price_per_liter),
        fuel_amount: Number(fuelForm.fuel_amount),
        distance: Number(fuelForm.distance),
        total_cost,
      },
    ])

    if (!error) {
      setFuelForm({
        date: '',
        region: '',
        station: '',
        price_per_liter: '',
        fuel_amount: '',
        distance: '',
      })
      fetchRecords(currentMonth)
    }
  }

  const handleTollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.from('toll_records').insert([
      {
        date: tollForm.date,
        section: tollForm.section,
        amount: Number(tollForm.amount),
      },
    ])

    if (!error) {
      setTollForm({
        date: '',
        section: '',
        amount: '',
      })
      fetchRecords(currentMonth)
    }
  }

  const handleBudgetSave = async () => {
    await supabase.from('settings').upsert(
      {
        key: 'monthly_budget',
        value: String(monthlyBudget),
        year_month: currentMonth,
      },
      { onConflict: 'key,year_month' }
    )
    setEditingBudget(false)
  }

  const handleMemoSave = async () => {
    await supabase.from('settings').upsert(
      {
        key: 'memo',
        value: memo,
        year_month: '',
      },
      { onConflict: 'key,year_month' }
    )
    setEditingMemo(false)
  }

  const handleDeleteFuel = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('fuel_records').delete().eq('id', id)
      fetchRecords(currentMonth)
    }
    setOpenMenuId(null)
  }

  const handleDeleteToll = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('toll_records').delete().eq('id', id)
      fetchRecords(currentMonth)
    }
    setOpenMenuId(null)
  }

  // 주유 기록 수정 시작
  const startEditFuel = (record: FuelRecord) => {
    setEditingRecordId(record.id)
    setOpenMenuId(null)
  }

  // 톨게이트 기록 수정 시작
  const startEditToll = (record: TollRecord) => {
    setEditingRecordId(record.id)
    setOpenMenuId(null)
  }

  // 주유 기록 수정 저장
  const handleUpdateFuel = async (record: FuelRecord) => {
    const total_cost = record.price_per_liter * record.fuel_amount

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
        total_cost,
      })
      .eq('id', record.id)

    if (!error) {
      setEditingRecordId(null)
      fetchRecords(currentMonth)
    }
  }

  // 톨게이트 기록 수정 저장
  const handleUpdateToll = async (record: TollRecord) => {
    const { error } = await supabase
      .from('toll_records')
      .update({
        date: record.date,
        section: record.section,
        amount: record.amount,
      })
      .eq('id', record.id)

    if (!error) {
      setEditingRecordId(null)
      fetchRecords(currentMonth)
    }
  }

  // 수정 취소
  const cancelEdit = () => {
    setEditingRecordId(null)
    fetchRecords(currentMonth) // 원래 데이터로 복원
  }

  const totalFuelCost = fuelRecords.reduce((sum, r) => sum + r.total_cost, 0)
  const totalTollCost = tollRecords.reduce((sum, r) => sum + r.amount, 0)
  const totalDistance = fuelRecords.reduce((sum, r) => sum + r.distance, 0)
  const totalFuelAmount = fuelRecords.reduce((sum, r) => sum + r.fuel_amount, 0)
  const avgEfficiency = totalDistance > 0 && totalFuelAmount > 0 ? (totalDistance / totalFuelAmount).toFixed(2) : '0.00'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-center">⛽ 주유 관리</h1>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* 월 선택 */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">조회 월</label>
          <input
            type="month"
            value={currentMonth}
            onChange={handleMonthChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">주유비</div>
            <div className="text-xl font-bold text-blue-600">{totalFuelCost.toLocaleString()}원</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">톨비</div>
            <div className="text-xl font-bold text-green-600">{totalTollCost.toLocaleString()}원</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">평균 연비</div>
            <div className="text-xl font-bold text-purple-600">{avgEfficiency} km/L</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">주행거리</div>
            <div className="text-xl font-bold text-orange-600">{totalDistance.toLocaleString()} km</div>
          </div>
        </div>

        {/* 월 예산 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">이번 달 예산</span>
            {editingBudget ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                  className="w-32 px-2 py-1 border border-gray-300 rounded"
                />
                <button onClick={handleBudgetSave} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                  저장
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-lg font-bold">{monthlyBudget.toLocaleString()}원</span>
                <button onClick={() => setEditingBudget(true)} className="text-blue-500 text-sm">
                  수정
                </button>
              </div>
            )}
          </div>
          {monthlyBudget > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>사용액: {(totalFuelCost + totalTollCost).toLocaleString()}원</span>
                <span>잔액: {(monthlyBudget - totalFuelCost - totalTollCost).toLocaleString()}원</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(((totalFuelCost + totalTollCost) / monthlyBudget) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="font-medium text-gray-700">메모</span>
            {!editingMemo && (
              <button onClick={() => setEditingMemo(true)} className="text-blue-500 text-sm">
                수정
              </button>
            )}
          </div>
          {editingMemo ? (
            <div>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
              <button onClick={handleMemoSave} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                저장
              </button>
            </div>
          ) : (
            <pre className="text-sm text-gray-600 whitespace-pre-wrap">{memo}</pre>
          )}
        </div>

        {/* 탭 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('fuel')}
              className={`flex-1 py-3 font-medium transition-colors ${
                activeTab === 'fuel' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⛽ 주유 기록
            </button>
            <button
              onClick={() => setActiveTab('toll')}
              className={`flex-1 py-3 font-medium transition-colors ${
                activeTab === 'toll' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🛣️ 톨게이트
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'fuel' ? (
              <div className="space-y-4">
                <form onSubmit={handleFuelSubmit} className="space-y-3">
                  <input
                    type="date"
                    value={fuelForm.date}
                    onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="지역"
                    value={fuelForm.region}
                    onChange={(e) => setFuelForm({ ...fuelForm, region: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="주유소"
                    value={fuelForm.station}
                    onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="리터당 가격"
                    value={fuelForm.price_per_liter}
                    onChange={(e) => setFuelForm({ ...fuelForm, price_per_liter: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="주유량 (L)"
                    value={fuelForm.fuel_amount}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuel_amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <div>
                    <input
                      type="number"
                      placeholder="주행거리 (km)"
                      value={fuelForm.distance}
                      onChange={(e) => setFuelForm({ ...fuelForm, distance: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">주행거리 (이전 주유일자부터 당일 주유일까지의 총 주행거리, km)</p>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    추가
                  </button>
                </form>

                <div className="space-y-2">
                  {fuelRecords.map((record) => (
                    <div key={record.id}>
                      {editingRecordId === record.id ? (
                        // 수정 모드
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                          <input
                            type="date"
                            value={record.date}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, date: e.target.value } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="time"
                            value={record.time || ''}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, time: e.target.value } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            placeholder="지역"
                            value={record.region || ''}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, region: e.target.value } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            placeholder="주유소"
                            value={record.station || ''}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, station: e.target.value } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="리터당 가격"
                            value={record.price_per_liter}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, price_per_liter: Number(e.target.value) } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="주유량 (L)"
                            value={record.fuel_amount}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, fuel_amount: Number(e.target.value) } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="주행거리 (km)"
                            value={record.distance}
                            onChange={(e) => {
                              const updated = fuelRecords.map((r) =>
                                r.id === record.id ? { ...r, distance: Number(e.target.value) } : r
                              )
                              setFuelRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateFuel(record)}
                              className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 일반 표시 모드
                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}
                              className="text-gray-500 hover:text-gray-700 text-2xl leading-none px-2"
                            >
                              ⋮
                            </button>
                            {openMenuId === record.id && (
                              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-24">
                                <button
                                  onClick={() => startEditFuel(record)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDeleteFuel(record.id)}
                                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            {record.date} {record.time && `• ${record.time}`}
                          </div>
                          {(record.region || record.station) && (
                            <div className="text-sm text-gray-600 mb-2">
                              {record.region} {record.station}
                            </div>
                          )}
                          <div className="flex justify-between items-end">
                            <div className="space-y-1">
                              <div className="text-sm text-gray-600">
                                {record.price_per_liter.toLocaleString()}원/L × {record.fuel_amount}L
                              </div>
                              <div className="text-sm text-gray-600">{record.distance.toLocaleString()}km 주행</div>
                              <div className="text-sm text-gray-600">
                                연비: {(record.distance / record.fuel_amount).toFixed(2)} km/L
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-blue-600">{record.total_cost.toLocaleString()}원</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleTollSubmit} className="space-y-3">
                  <input
                    type="date"
                    value={tollForm.date}
                    onChange={(e) => setTollForm({ ...tollForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="구간"
                    value={tollForm.section}
                    onChange={(e) => setTollForm({ ...tollForm, section: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="금액"
                    value={tollForm.amount}
                    onChange={(e) => setTollForm({ ...tollForm, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    추가
                  </button>
                </form>

                <div className="space-y-2">
                  {tollRecords.map((record) => (
                    <div key={record.id}>
                      {editingRecordId === record.id ? (
                        // 수정 모드
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                          <input
                            type="date"
                            value={record.date}
                            onChange={(e) => {
                              const updated = tollRecords.map((r) =>
                                r.id === record.id ? { ...r, date: e.target.value } : r
                              )
                              setTollRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            placeholder="구간"
                            value={record.section || ''}
                            onChange={(e) => {
                              const updated = tollRecords.map((r) =>
                                r.id === record.id ? { ...r, section: e.target.value } : r
                              )
                              setTollRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="금액"
                            value={record.amount}
                            onChange={(e) => {
                              const updated = tollRecords.map((r) =>
                                r.id === record.id ? { ...r, amount: Number(e.target.value) } : r
                              )
                              setTollRecords(updated)
                            }}
                            className="w-full px-3 py-1 border border-gray-300 rounded"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateToll(record)}
                              className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 일반 표시 모드
                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}
                              className="text-gray-500 hover:text-gray-700 text-2xl leading-none px-2"
                            >
                              ⋮
                            </button>
                            {openMenuId === record.id && (
                              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-24">
                                <button
                                  onClick={() => startEditToll(record)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDeleteToll(record.id)}
                                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">{record.date}</div>
                          {record.section && <div className="text-sm text-gray-600 mb-2">{record.section}</div>}
                          <div className="text-2xl font-bold text-green-600">{record.amount.toLocaleString()}원</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
