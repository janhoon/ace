import { createRouter, createWebHistory } from 'vue-router'
import DashboardsView from '../views/DashboardsView.vue'
import DashboardDetailView from '../views/DashboardDetailView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboards'
    },
    {
      path: '/dashboards',
      name: 'dashboards',
      component: DashboardsView
    },
    {
      path: '/dashboards/:id',
      name: 'dashboard-detail',
      component: DashboardDetailView
    }
  ]
})

export default router
