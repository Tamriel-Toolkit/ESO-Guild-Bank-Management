import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Card, CardContent, Typography, Button, Stack, Box } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { getEventsForGuild, createEventForGuild, updateEventInGuild, deleteEventFromGuild } from '../api'
import EventDialog from './EventDialog'
import EventDetailView from './EventDetailView'

function CalendarPage({ selectedGuild, trackedMembers, canEdit }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [initialDate, setInitialDate] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOccurrence, setSelectedOccurrence] = useState(null)

  const loadEvents = useCallback(async (start, end) => {
    if (!selectedGuild) return
    setLoading(true)
    try {
      const response = await getEventsForGuild(selectedGuild.id, start, end)
      const formattedEvents = response.events.map(e => ({
        id: e.id,
        title: e.title,
        start: e.startTime,
        end: e.endTime,
        extendedProps: { ...e }
      }))
      setEvents(formattedEvents)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedGuild])

  const handleDatesSet = (dateInfo) => {
    loadEvents(dateInfo.startStr, dateInfo.endStr)
  }

  const handleEventClick = (info) => {
    setSelectedOccurrence({
      event: info.event.extendedProps,
      date: info.event.startStr.slice(0, 10)
    })
    setDetailOpen(true)
  }

  const handleDateClick = (info) => {
    if (!canEdit) return
    setInitialDate(info.dateStr)
    setEditingEvent(null)
    setDialogOpen(true)
  }

  const handleSaveEvent = async (draft) => {
    if (editingEvent) {
      await updateEventInGuild(selectedGuild.id, editingEvent.id, draft)
    } else {
      await createEventForGuild(selectedGuild.id, draft)
    }
    // Refresh events - ideally FullCalendar does this via handleDatesSet but let's be sure
    // info.view.calendar.refetchEvents() could be used if we use eventSources
    // For now, let's just reload
    const calendarApi = document.querySelector('.fc')._calendarApi // Hacky but works for manual refresh
    if (calendarApi) {
      loadEvents(calendarApi.view.activeStart.toISOString(), calendarApi.view.activeEnd.toISOString())
    }
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Guild Calendar</Typography>
              <Typography variant="body2" color="text.secondary">
                View and manage upcoming trials and events for {selectedGuild.name}.
              </Typography>
            </Box>
          </Stack>

          <Box sx={{
            '& .fc': {
              '--fc-border-color': 'rgba(199, 161, 93, 0.2)',
              '--fc-today-bg-color': 'rgba(199, 161, 93, 0.05)',
              fontFamily: 'inherit'
            },
            '& .fc-event': { cursor: 'pointer' }
          }}>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={events}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              height="auto"
            />
          </Box>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ mt: 2 }}
              onClick={() => {
                setInitialDate(new Date().toISOString().slice(0, 10))
                setEditingEvent(null)
                setDialogOpen(true)
              }}
            >
              Create Event
            </Button>
          )}
        </CardContent>
      </Card>

      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveEvent}
        event={editingEvent}
        initialDate={initialDate}
      />

      <EventDetailView
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        guildId={selectedGuild.id}
        event={selectedOccurrence?.event}
        occurrenceDate={selectedOccurrence?.date}
        trackedMembers={trackedMembers}
        canEdit={canEdit}
      />
    </Stack>
  )
}

export default CalendarPage
