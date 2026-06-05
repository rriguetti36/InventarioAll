import React from 'react'
import { Navigate } from 'react-router-dom'
import { Center, Spinner } from '@chakra-ui/react'

export default function ProtectedRoute({ children }){
  const token = localStorage.getItem('token')
  if(!token) return <Navigate to='/' replace />
  // Optionally, could validate token here
  return children
}
